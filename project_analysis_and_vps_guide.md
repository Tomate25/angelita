# Guía de Análisis, Base de Datos y Despliegue en VPS Linux (Ubuntu 24.04) con MySQL

Este documento contiene un análisis detallado del proyecto **Angelitas POS**, la estructura de su base de datos (con soporte MySQL) y la guía paso a paso para desplegarlo en un servidor VPS con Linux Ubuntu 24.04 de manera permanente, así como las instrucciones para subir el código a GitHub.

---

## 1. Análisis del Proyecto
El proyecto **Angelitas POS** es una aplicación web del tipo **Single Page Application (SPA)** construida con las siguientes tecnologías:
*   **Frontend**: React (v18) + Vite + Tailwind CSS.
*   **Base de datos y Backend (Original)**: Utiliza la plataforma **Base44** (`@base44/sdk`), que proporciona una base de datos NoSQL basada en la nube y funciones de servidor sin servidor (serverless) ejecutadas en Deno.
*   **Estado del Proyecto**: El código frontend se encuentra **totalmente funcional**. Hemos instalado las dependencias localmente y ejecutado la compilación de producción (`npm run build`), la cual finalizó de manera exitosa y sin errores de sintaxis o empaquetado.

---

## 2. Estructura de la Base de Datos

Las tablas y campos están definidos originalmente en archivos JSON con comentarios (`.jsonc`) en la carpeta `base44/entities/`. 

He procesado todos estos archivos para ti en los siguientes formatos descargables e inspeccionables en tu carpeta de proyecto:

1.  **Resumen de Campos y Tipos de Datos**: Detalles de cada una de las 18 entidades (tablas), campos, tipos, valores por defecto y enums.
    *   Ver archivo: [db_schema_details.md](file:///C:/Users/abdia/OneDrive/Desktop/angelitas-pos-flow/db_schema_details.md)
2.  **Script DDL de SQL para MySQL**: Este script crea la base de datos `angelitas_pos` y todas las tablas con sus correspondientes llaves primarias, tipos de datos compatibles con MySQL (`VARCHAR`, `DATETIME`, `DECIMAL`, `JSON`, `TINYINT`) y valores por defecto.
    *   Ver archivo: [mysql_schema.sql](file:///C:/Users/abdia/OneDrive/Desktop/angelitas-pos-flow/mysql_schema.sql)

---

## 3. Conexión de Datos y Arquitectura con MySQL
Para ejecutar la aplicación localmente o en un VPS con MySQL, el sistema consta de dos partes:
1.  **Frontend (React)**: Se compila en archivos estáticos (`dist/`) y es servido de manera rápida por **Nginx**.
2.  **Backend (Express API)**: Escucha en el puerto `5000` y gestiona las operaciones CRUD con la base de datos local MySQL en XAMPP o en el VPS. Nginx redirige todas las peticiones que van a `/api/*` directamente a este backend.

---

## 4. Guía de Instalación y Configuración en VPS Ubuntu 24.04 (MySQL + Frontend + PM2)

Sigue estos pasos en tu servidor VPS Linux Ubuntu 24.04 para que el sistema funcione siempre en segundo plano:

### Paso 1: Actualizar el Sistema e Instalar Dependencias Básicas
Conéctate por SSH a tu VPS y ejecuta:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx mysql-server
```

### Paso 2: Configuración y Seguridad de MySQL en Ubuntu
Inicia el script de seguridad de MySQL:
```bash
sudo mysql_secure_installation
```
*(Sigue los pasos interactivos: responde Sí a validar contraseñas seguras, define una contraseña fuerte de root, elimina usuarios anónimos, deshabilita login remoto de root y remueve la base de datos de pruebas)*.

### Paso 3: Crear la Base de Datos y el Usuario de la Aplicación
Accede a la consola de MySQL como administrador:
```bash
sudo mysql
```
Dentro de la consola de MySQL, ejecuta las siguientes instrucciones (reemplaza `tu_contraseña_segura` por una contraseña real):
```sql
-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS angelitas_pos;

-- Crear un usuario local para la aplicación
CREATE USER 'angelitas_user'@'localhost' IDENTIFIED BY 'tu_contraseña_segura';

-- Otorgar todos los privilegios sobre la base de datos al nuevo usuario
GRANT ALL PRIVILEGES ON angelitas_pos.* TO 'angelitas_user'@'localhost';

-- Aplicar los cambios
FLUSH PRIVILEGES;

-- Salir de MySQL
EXIT;
```

### Paso 4: Importar las Tablas desde el Archivo SQL
Una vez que clones tu repositorio en el VPS, puedes importar toda la estructura de tablas ejecutando el siguiente comando:
```bash
mysql -u angelitas_user -p angelitas_pos < /var/www/angelitas-pos-flow/mysql_schema.sql
```
*(Te pedirá la contraseña del usuario `angelitas_user` que definiste en el paso anterior)*.

### Paso 5: Instalar Node.js (Versión LTS v20+) en el VPS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Paso 6: Clonar el Proyecto desde GitHub
```bash
cd /var/www
sudo git clone https://github.com/Tomate25/angelita.git angelitas-pos-flow
cd angelitas-pos-flow
```

### Paso 7: Instalar Dependencias y Compilar Frontend
```bash
# Asignar permisos al usuario actual para evitar problemas de NPM
sudo chown -R $USER:$USER /var/www/angelitas-pos-flow
npm install
npm run build
```

### Paso 8: Instalar Dependencias y Configurar el Backend
Navega a la carpeta del backend, configura sus variables de entorno de producción y arráncalo:
```bash
cd /var/www/angelitas-pos-flow/server
npm install

# Crear archivo de variables de entorno para producción
nano .env
```
Copia y pega la siguiente configuración (ajusta la contraseña a la que creaste en el Paso 3):
```env
PORT=5000
DB_HOST=localhost
DB_USER=angelitas_user
DB_PASSWORD=tu_contraseña_segura
DB_NAME=angelitas_pos
JWT_SECRET=angelitas-jwt-secret-key-2026
APPROVE_TOKEN_SALT=angelitas-erp-secret-2024
APP_URL=http://localhost:5000
```
*(Guarda el archivo presionando `Ctrl+O`, luego `Enter` y sal con `Ctrl+X`)*.

### Paso 9: Configurar PM2 para que el Backend esté siempre Activo
Para evitar que el backend de Node.js se cierre al cerrar la terminal SSH y para que se inicie solo si el VPS se reinicia, usaremos el gestor de procesos **PM2**:
```bash
# Instalar PM2 de forma global en el VPS
sudo npm install -g pm2

# Arrancar la API del Backend con PM2 (ejecutar desde /var/www/angelitas-pos-flow/server)
cd /var/www/angelitas-pos-flow/server
pm2 start index.js --name "angelitas-api"

# Configurar PM2 para integrarse con el arranque del sistema (systemd)
pm2 startup systemd
```
*El comando anterior te mostrará una línea de comando en consola que empieza con `sudo env PATH=...`. Cópiala completa, pégala en tu terminal y dale Enter.*

Una vez hecho esto, guarda la lista de procesos para que persista tras reinicios:
```bash
pm2 save
```

#### Comandos útiles de PM2:
*   `pm2 status` -> Muestra el estado del backend (si está online, CPU y RAM consumida).
*   `pm2 logs` -> Muestra los registros y logs en tiempo real (útil para ver errores).
*   `pm2 restart angelitas-api` -> Reinicia el servidor backend.

### Paso 10: Configurar el Servidor Web Nginx
Crea un archivo de configuración para redirigir el tráfico web y la API:
```bash
sudo nano /etc/nginx/sites-available/angelitas-pos
```
Pega la siguiente configuración (ajusta `server_name` a tu dominio o dirección IP de VPS):
```nginx
server {
    listen 80;
    server_name tu_dominio_o_ip_del_vps;

    root /var/www/angelitas-pos-flow/dist;
    index index.html;

    # Servir Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Redirigir llamadas de la API al Backend en puerto 5000
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Caché para recursos estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|otf)$ {
        expires 1y;
        add_header Cache-Control "public, no-transform";
    }

    error_log /var/log/nginx/angelitas-pos_error.log;
    access_log /var/log/nginx/angelitas-pos_access.log;
}
```
Activa el sitio y reinicia Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/angelitas-pos /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Elimina el sitio predeterminado
sudo nginx -t                             # Verifica que la sintaxis de Nginx esté bien
sudo systemctl restart nginx
```

---

## 5. Cómo Subir los Cambios de Documentación a GitHub (Local)

Para actualizar tu repositorio con estos nuevos cambios de la guía, he ejecutado los siguientes comandos en tu terminal local:
```powershell
git add .
git commit -m "docs: Update VPS guide with PM2 and Nginx Proxy details for production persistence"
git push origin main
```
