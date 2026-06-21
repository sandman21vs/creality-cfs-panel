#!/bin/sh
# Creality CFS Panel - standalone installer
# Para K1 / K1C / K1 Max ROOTEADAS com o Creality Helper Script (Moonraker + Nginx).
#
# Uso (na impressora, via SSH):
#   git clone --depth 1 <repo> /usr/data/creality-cfs-panel-src
#   sh /usr/data/creality-cfs-panel-src/install.sh
#
# O que faz:
#   1. Copia o painel (index.html + css/ + js/) para /usr/data/creality-cfs-panel
#   2. Injeta um server block na config do Nginx do Helper Script (porta 4410)
#   3. Reinicia o Nginx
#
# Idempotente: rodar de novo apenas atualiza os arquivos e o server block.

set -e

PANEL_NAME="creality-cfs-panel"
PANEL_PORT=4410
SRC_DIR="$(dirname "$(readlink -f "$0")")"
DEST_DIR="/usr/data/${PANEL_NAME}"
NGINX_INITD="/etc/init.d/S50nginx"
MARK_BEGIN="    # >>> ${PANEL_NAME} >>>"
MARK_END="    # <<< ${PANEL_NAME} <<<"

info() { echo "Info: $*"; }
ok()   { echo "OK: $*"; }
err()  { echo "Error: $*" >&2; }

# Descobre o nginx.conf ativo do Helper Script. O caminho varia entre firmwares:
#   - Guilouz original: /usr/data/nginx/nginx/nginx.conf (carregado via -c no S50nginx)
#   - fork Nik-oli:     /etc/nginx/nginx.conf
# Estrategia: ler o '-c' do servico; senao, tentar candidatos conhecidos.
detect_nginx_conf() {
  local c=""
  if [ -f "${NGINX_INITD}" ]; then
    c="$(sed -n 's/.*-c[[:space:]]*\([^" ]*nginx\.conf\).*/\1/p' "${NGINX_INITD}" | head -n1)"
    if [ -n "${c}" ] && [ -f "${c}" ]; then echo "${c}"; return; fi
  fi
  for c in /usr/data/nginx/nginx/nginx.conf /etc/nginx/nginx.conf; do
    [ -f "${c}" ] && { echo "${c}"; return; }
  done
}

# --- 1. Sanity checks ---------------------------------------------------------
if [ ! -f "${SRC_DIR}/index.html" ]; then
  err "index.html nao encontrado em ${SRC_DIR} (rode este script de dentro do repo)."
  exit 1
fi

NGINX_CONF="$(detect_nginx_conf)"
if [ -z "${NGINX_CONF}" ]; then
  err "nginx.conf do Helper Script nao encontrado."
  err "Instale 'Moonraker and Nginx' pelo Helper Script primeiro."
  exit 1
fi
info "Usando nginx.conf: ${NGINX_CONF}"

if ! grep -qE '^[[:space:]]*http[[:space:]]*\{' "${NGINX_CONF}"; then
  err "Bloco 'http {' nao encontrado em ${NGINX_CONF}; config inesperada, abortando."
  exit 1
fi

# --- 2. Copia os arquivos do painel ------------------------------------------
info "Copiando painel para ${DEST_DIR}..."
rm -rf "${DEST_DIR}"
mkdir -p "${DEST_DIR}"
cp -a "${SRC_DIR}/index.html" "${DEST_DIR}/"
cp -a "${SRC_DIR}/css"        "${DEST_DIR}/"
cp -a "${SRC_DIR}/js"         "${DEST_DIR}/"

# --- 3. Injeta o server block no Nginx (idempotente) -------------------------
# Remove um bloco antigo (entre os marcadores), se existir.
if grep -qF "${MARK_BEGIN}" "${NGINX_CONF}"; then
  info "Atualizando server block existente do Nginx..."
  sed -i "/$(printf '%s' "${MARK_BEGIN}" | sed 's/[][\\.*^$/]/\\&/g')/,/$(printf '%s' "${MARK_END}" | sed 's/[][\\.*^$/]/\\&/g')/d" "${NGINX_CONF}"
else
  info "Adicionando server block do Nginx (porta ${PANEL_PORT})..."
fi

# Backup uma unica vez.
[ -f "${NGINX_CONF}.cfspanel.bak" ] || cp "${NGINX_CONF}" "${NGINX_CONF}.cfspanel.bak"

BLOCK="${MARK_BEGIN}
    server {
        listen ${PANEL_PORT} default_server;
        access_log off;
        error_log off;
        gzip on;
        gzip_types text/plain text/css application/javascript application/json;
        root ${DEST_DIR};
        index index.html;
        server_name _;
        location / {
            try_files \$uri \$uri/ /index.html;
        }
        location = /index.html {
            add_header Cache-Control \"no-store, no-cache, must-revalidate\";
        }
    }
${MARK_END}"

# Insere o bloco logo apos a primeira linha 'http {'.
awk -v block="${BLOCK}" '
  !done && /^[[:space:]]*http[[:space:]]*\{/ { print; print block; done=1; next }
  { print }
' "${NGINX_CONF}" > "${NGINX_CONF}.tmp" && mv "${NGINX_CONF}.tmp" "${NGINX_CONF}"

if ! grep -qF "${MARK_BEGIN}" "${NGINX_CONF}"; then
  err "Falha ao injetar o server block; restaurando backup."
  cp "${NGINX_CONF}.cfspanel.bak" "${NGINX_CONF}"
  exit 1
fi

# --- 4. Reinicia o Nginx ------------------------------------------------------
info "Reiniciando Nginx..."
set +e
"${NGINX_INITD}" restart >/dev/null 2>&1
set -e

IP="$(ifconfig 2>/dev/null | awk '/inet addr/{sub("addr:","",$2); print $2}' | grep -v '^127\.' | head -n1)"
[ -n "${IP}" ] || IP="<ip-da-impressora>"

echo ""
ok "Creality CFS Panel instalado!"
echo "   Acesse: http://${IP}:${PANEL_PORT}"
echo "   Para remover: sh ${SRC_DIR}/uninstall.sh"
