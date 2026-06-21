# Creality CFS Panel — módulo do Helper Script

Arquivos prontos para integrar o painel ao **Creality Helper Script** (fork K1-CFS) como
um módulo nativo: entra no menu **Install/Remove**, serve via Nginx na porta **4410**.

> Se você só quer instalar o painel agora, use o **instalador standalone** na raiz do repo
> (`install.sh` / `uninstall.sh`) — não precisa mexer no Helper Script. Este diretório é
> para quem mantém um fork do Helper Script e quer o painel no menu.

## Passos de integração

### 1. Copiar o script do módulo
```
cp helper-script/scripts/cfs_panel.sh  <helper-script>/scripts/cfs_panel.sh
```
O `helper.sh` já faz `for script in scripts/*.sh; do . "$script"; done`, então o módulo é
carregado automaticamente.

### 2. Empacotar os arquivos do painel
Copie o painel (raiz deste repo) para `files/cfs-panel/` do Helper Script:
```
mkdir -p <helper-script>/files/cfs-panel
cp -a index.html css js  <helper-script>/files/cfs-panel/
```

### 3. Adicionar as variáveis em `scripts/paths.sh`
Dentro de `set_paths()`, junto dos outros blocos:
```sh
  # CFS Panel #
  CFS_PANEL_SRC="${HS_FILES}/cfs-panel"
  CFS_PANEL_FOLDER="${USR_DATA}/creality-cfs-panel"
  CFS_PANEL_PORT="4410"
  # Guilouz original usa /usr/data/nginx/nginx/nginx.conf; fork Nik-oli usa /etc/nginx/nginx.conf
  NGINX_MAIN_CONF="/usr/data/nginx/nginx/nginx.conf"
```

### 4. Adicionar ao menu de instalação (`scripts/menu/K1/install_menu_K1.sh`)
Uma `menu_option` na seção `•ESSENTIALS:` (ajuste a numeração):
```sh
  menu_option ' 4' 'Install' 'Creality CFS Panel (port 4410)'
```
E o `case` correspondente em `install_menu_k1()`:
```sh
      4)
        if [ -d "$CFS_PANEL_FOLDER" ]; then
          error_msg "Creality CFS Panel is already installed!"
        elif [ ! -d "$MOONRAKER_FOLDER" ] && [ ! -d "$NGINX_FOLDER" ]; then
          error_msg "Moonraker and Nginx are needed, please install them first!"
        else
          run "install_cfs_panel" "install_menu_ui_k1"
        fi;;
```

### 5. Adicionar ao menu de remoção (`scripts/menu/K1/remove_menu_K1.sh`)
Análogo, chamando `run "remove_cfs_panel" "remove_menu_ui_k1"`.

## Notas
- Requer **Moonraker + Nginx** do Helper Script instalados (o painel é servido pelo mesmo Nginx).
- O server block é injetado dentro do `http { }` de `/etc/nginx/nginx.conf` entre marcadores
  `# >>> creality-cfs-panel >>>` / `# <<< ... <<<`, de forma **idempotente** (reinstalar só atualiza).
- Porta **4410** é livre por porta (`default_server` é por porta), não conflita com Fluidd/Mainsail.
- O painel detecta o host automaticamente: servido da impressora, já conecta no WS:9999 local.
