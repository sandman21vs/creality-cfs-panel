#!/bin/sh
# Creality CFS Panel - modulo no formato do Creality Helper Script.
#
# Como integrar no fork do Helper Script:
#   1. Copie este arquivo para        scripts/cfs_panel.sh
#   2. Copie os arquivos do painel     files/cfs-panel/   (index.html, css/, js/)
#   3. Adicione em scripts/paths.sh as variaveis do bloco "# CFS Panel #" abaixo
#   4. Adicione as entradas de menu (ver helper-script/README.md)
#
# Serve o painel via Nginx na porta 4410 (estilo Fluidd 4408 / Mainsail 4409).

set -e

# --- Variaveis (mover para scripts/paths.sh, dentro de set_paths) -------------
# CFS Panel #
# CFS_PANEL_SRC="${HS_FILES}/cfs-panel"
# CFS_PANEL_FOLDER="${USR_DATA}/creality-cfs-panel"
# CFS_PANEL_PORT="4410"
# NGINX_MAIN_CONF="/etc/nginx/nginx.conf"

CFS_PANEL_MARK_BEGIN="    # >>> creality-cfs-panel >>>"
CFS_PANEL_MARK_END="    # <<< creality-cfs-panel <<<"

function cfs_panel_message() {
  top_line
  title 'Creality CFS Panel' "${yellow}"
  inner_line
  hr
  echo -e " │ ${cyan}Painel web (estilo CrealityPrint) para a CFS e o dispositivo. ${white}│"
  echo -e " │ ${cyan}Ve slots, cor, produto, %, umidade/temp via WS:9999.          ${white}│"
  echo -e " │ ${cyan}Sera acessivel na porta ${CFS_PANEL_PORT}.                                  ${white}│"
  hr
  bottom_line
}

function _cfs_panel_inject_nginx() {
  # Remove bloco antigo, se existir.
  if grep -qF "${CFS_PANEL_MARK_BEGIN}" "${NGINX_MAIN_CONF}"; then
    sed -i "/$(printf '%s' "${CFS_PANEL_MARK_BEGIN}" | sed 's/[][\\.*^$/]/\\&/g')/,/$(printf '%s' "${CFS_PANEL_MARK_END}" | sed 's/[][\\.*^$/]/\\&/g')/d" "${NGINX_MAIN_CONF}"
  fi

  local block="${CFS_PANEL_MARK_BEGIN}
    server {
        listen ${CFS_PANEL_PORT} default_server;
        access_log off;
        error_log off;
        gzip on;
        gzip_types text/plain text/css application/javascript application/json;
        root ${CFS_PANEL_FOLDER};
        index index.html;
        server_name _;
        location / {
            try_files \$uri \$uri/ /index.html;
        }
        location = /index.html {
            add_header Cache-Control \"no-store, no-cache, must-revalidate\";
        }
    }
${CFS_PANEL_MARK_END}"

  awk -v block="${block}" '
    !done && /^[[:space:]]*http[[:space:]]*\{/ { print; print block; done=1; next }
    { print }
  ' "${NGINX_MAIN_CONF}" > "${NGINX_MAIN_CONF}.tmp" && mv "${NGINX_MAIN_CONF}.tmp" "${NGINX_MAIN_CONF}"
}

function _cfs_panel_remove_nginx() {
  if grep -qF "${CFS_PANEL_MARK_BEGIN}" "${NGINX_MAIN_CONF}"; then
    sed -i "/$(printf '%s' "${CFS_PANEL_MARK_BEGIN}" | sed 's/[][\\.*^$/]/\\&/g')/,/$(printf '%s' "${CFS_PANEL_MARK_END}" | sed 's/[][\\.*^$/]/\\&/g')/d" "${NGINX_MAIN_CONF}"
  fi
}

function install_cfs_panel() {
  cfs_panel_message
  local yn
  while true; do
    install_msg "Creality CFS Panel" yn
    case "${yn}" in
      Y|y)
        echo -e "${white}"
        echo -e "Info: Copying panel files..."
        rm -rf "$CFS_PANEL_FOLDER"
        mkdir -p "$CFS_PANEL_FOLDER"
        cp -a "$CFS_PANEL_SRC"/. "$CFS_PANEL_FOLDER"/
        echo -e "Info: Configuring Nginx (port ${CFS_PANEL_PORT})..."
        _cfs_panel_inject_nginx
        echo -e "Info: Restarting Nginx service..."
        restart_nginx
        ok_msg "Creality CFS Panel has been installed successfully!"
        echo -e "   You can now connect to the panel with ${yellow}http://$(check_ipaddress):${CFS_PANEL_PORT}${white}"
        return;;
      N|n)
        error_msg "Installation canceled!"
        return;;
      *)
        error_msg "Please select a correct choice!";;
    esac
  done
}

function remove_cfs_panel() {
  cfs_panel_message
  local yn
  while true; do
    remove_msg "Creality CFS Panel" yn
    case "${yn}" in
      Y|y)
        echo -e "${white}"
        echo -e "Info: Removing Nginx configuration..."
        _cfs_panel_remove_nginx
        echo -e "Info: Removing files..."
        rm -rf "$CFS_PANEL_FOLDER"
        echo -e "Info: Restarting Nginx service..."
        restart_nginx
        ok_msg "Creality CFS Panel has been removed successfully!"
        return;;
      N|n)
        error_msg "Deletion canceled!"
        return;;
      *)
        error_msg "Please select a correct choice!";;
    esac
  done
}
