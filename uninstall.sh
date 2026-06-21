#!/bin/sh
# Creality CFS Panel - desinstalador standalone
# Remove o server block do Nginx e os arquivos do painel.

set -e

PANEL_NAME="creality-cfs-panel"
DEST_DIR="/usr/data/${PANEL_NAME}"
NGINX_CONF="/etc/nginx/nginx.conf"
NGINX_INITD="/etc/init.d/S50nginx"
MARK_BEGIN="    # >>> ${PANEL_NAME} >>>"
MARK_END="    # <<< ${PANEL_NAME} <<<"

info() { echo "Info: $*"; }
ok()   { echo "OK: $*"; }

if [ -f "${NGINX_CONF}" ] && grep -qF "${MARK_BEGIN}" "${NGINX_CONF}"; then
  info "Removendo server block do Nginx..."
  sed -i "/$(printf '%s' "${MARK_BEGIN}" | sed 's/[][\\.*^$/]/\\&/g')/,/$(printf '%s' "${MARK_END}" | sed 's/[][\\.*^$/]/\\&/g')/d" "${NGINX_CONF}"
  info "Reiniciando Nginx..."
  set +e
  "${NGINX_INITD}" restart >/dev/null 2>&1
  set -e
else
  info "Nenhum server block encontrado no Nginx."
fi

if [ -d "${DEST_DIR}" ]; then
  info "Removendo ${DEST_DIR}..."
  rm -rf "${DEST_DIR}"
fi

ok "Creality CFS Panel removido."
