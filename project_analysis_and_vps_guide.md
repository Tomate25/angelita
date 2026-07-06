# Guía de Análisis, Base de Datos y Despliegue en VPS Linux (Ubuntu 24.04) con MySQL

Este documento contiene un análisis detallado del proyecto **Angelitas POS**, la estructura de su base de datos (con soporte MySQL) y la guía paso a paso para desplegarlo en un servidor VPS con Linux Ubuntu 24.04, así como las instrucciones para subir el código a GitHub.

---

## 1. Análisis del Proyecto
El proyecto **Angelitas POS** es una aplicación web del tipo **Single Page Application (SPA)** construida con las siguientes tecnologías:
*   **Frontend**: React (v18) + Vite + Tailwind CSS.
*   **Base de datos y Backend (Original)**: Utiliza la plataforma **Base44** (`@base44/sdk`), que proporciona una base de datos NoSQL basada en la nube y funciones de servidor sin servidor (serverless) ejecutadas en Deno.
*   **Estado del Proyecto**: El código frontend se encuentra **totalmente funcional**. Hemos instalado las dependencias localmente y ejecutado la compilación de producción (`npm run build`), la cual finalizó de manera exitosa y sin errores de sintaxis o empaquetado.

---

## 2. Estructura de la Base de Datos

Las tablas y campos están definidos originalmente en archivos JSON con comentarios (`.jsonc`) en la carpeta `base44/entities/`. 

He procesado todos estos archivos para ti en los siguientes formatos descargables e inspeccionables en tu carpeta de artefactos:

1.  **Resumen de Campos y Tipos de Datos**: Detalles de cada una de las 18 entidades (tablas), campos, tipos, valores por defecto y enums.
    *   Ver archivo: [db_schema_details.md](file:///C:/Users/abdia/.gemini/antigravity-cli/brain/430bb670-6ed8-44d9-9cae-a91f4d68ed7a/db_schema_details.md)
2.  **Script DDL de SQL para MySQL (Recomendado para tu migración)**: Este script crea la base de datos `angelitas_pos` y todas las tablas con sus correspondientes llaves primarias, tipos de datos compatibles con MySQL (`VARCHAR`, `DATETIME`, `DECIMAL`, `JSON`, `TINYINT`) y valores por defecto.
    *   Ver archivo: [mysql_schema.sql](file:///C:/Users/abdia/.gemini/antigravity-cli/brain/430bb670-6ed8-44d9-9cae-a91f4d68ed7a/mysql_schema.sql)
3.  **Script DDL de SQL para PostgreSQL**: Por si prefieres esa alternativa.
    *   Ver archivo: [postgres_schema.sql](file:///C:/Users/abdia/.gemini/antigravity-cli/brain/430bb670-6ed8-44d9-9cae-a91f4d68ed7a/postgres_schema.sql)

### Tablas Principales (Entidades):
*   `User`: Control de accesos y roles asignados a sucursales (`admin`, `granada`, `cofradia`, `prefaconsa`).
*   `Branch`: Gestión de puntos de venta (Sucursales).
*   `Product` y `Category`: Catálogo de inventario, precios (normal, mayorista, especial), costo y transformación de productos.
*   `Inventory` e `InventoryMovement`: Control de stock físico y kardex por cada sucursal.
*   `Order` y `OrderSequence`: Registro de ventas en el POS, montos, métodos de pago, totales y correlativos.
*   `Customer`, `AccountReceivable` y `ARPayment`: Cuentas por cobrar a clientes, límites de crédito y pagos.
*   `Supplier`, `Purchase`, `SupplierInvoice` y `SupplierPayment`: Compras, órdenes de compra con flujo de aprobación, cuentas por pagar a proveedores y registro de pagos.
*   `Transfer`: Traslados de mercancía entre sucursales.
*   `CashRegister`: Control de aperturas, arqueos y cierres de caja por turno.

---

## 3. Opciones de Despliegue en VPS (Linux Ubuntu 24.04)

### Opción A: Desplegar el Frontend en el VPS + Backend en Base44 Cloud (Easiest & Ready)
En esta opción, el VPS aloja únicamente los archivos estáticos de tu aplicación (HTML/CSS/JS) de forma segura y veloz usando **Nginx**. La base de datos y la autenticación se siguen gestionando en los servidores de Base44 en la nube.
*   **Ventajas**: Es sumamente rápido de configurar, no requiere mantenimiento de base de datos ni copias de seguridad en el VPS, y escala automáticamente.
*   **Dependencias a instalar en el VPS**: `git`, `nodejs`, `npm`, `nginx`.

### Opción B: Autohospedaje Completo (Self-Hosted) con MySQL
Si deseas que la base de datos se ejecute en tu propio VPS utilizando **MySQL**:
*   **La Arquitectura Necesaria**: Una aplicación React (frontend) corre en el navegador del usuario y **no puede conectarse directamente a MySQL** por razones de seguridad y diseño. Necesitas un **servidor backend** (como un API REST escrito en Node.js/Express) ejecutándose en tu VPS que reciba las peticiones HTTP del frontend, realice las consultas en la base de datos MySQL y retorne los datos.
*   **Modificaciones requeridas**:
    1.  Escribir un servidor Express (Node.js) con rutas para cada una de las 18 tablas (ej: `GET /api/products`, `POST /api/orders`, etc.).
    2.  Modificar la inicialización del cliente en el frontend [base44Client.js](file:///C:/Users/abdia/OneDrive/Desktop/angelitas-pos-flow/src/api/base44Client.js) para que use fetch/axios apuntando a tu servidor local en lugar del SDK de Base44.
    3.  Configurar e importar las tablas en el servidor MySQL local del VPS usando nuestro script [mysql_schema.sql](file:///C:/Users/abdia/.gemini/antigravity-cli/brain/430bb670-6ed8-44d9-9cae-a91f4d68ed7a/mysql_schema.sql).

---

## 4. Guía de Instalación y Configuración en VPS Ubuntu 24.04 (Para Opción B - MySQL + Frontend)

Sigue estos pasos en tu servidor VPS Linux Ubuntu 24.04.

### Paso 1: Actualizar el Sistema e Instalar Dependencias Básicas
Conéctate por SSH a tu VPS y ejecuta:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl nginx mysql-server
```

### Paso 2: Configuración y Seguridad de MySQL en Ubuntu
Inicia el script de seguridad para configurar tu contraseña de root y deshabilitar accesos inseguros:
```bash
sudo mysql_secure_installation
```
*(Sigue los pasos interactivos: responde Sí a validar contraseñas seguras, define una contraseña fuerte de root, elimina usuarios anónimos, deshabilita login remoto de root y remueve la base de datos de pruebas).*

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
Una vez que subas el archivo `mysql_schema.sql` a tu VPS, puedes importar toda la estructura de tablas ejecutando el siguiente comando:
```bash
mysql -u angelitas_user -p angelitas_pos < /ruta/a/tu/archivo/mysql_schema.sql
```
*(Te pedirá la contraseña del usuario `angelitas_user` que definiste en el paso anterior)*.

### Paso 5: Instalar Node.js (Versión LTS v20+) en el VPS
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```
Verifica las versiones:
```bash
node -v
npm -v
```

### Paso 6: Clonar el Proyecto desde GitHub
```bash
cd /var/www
sudo git clone https://github.com/TU_USUARIO/angelitas-pos-flow.git
cd angelitas-pos-flow
```

### Paso 7: Instalar Dependencias de Node y Compilar Frontend
```bash
# Asignar permisos al usuario actual para evitar problemas de permisos de NPM
sudo chown -R $USER:$USER /var/www/angelitas-pos-flow
npm install
npm run build
```

### Paso 8: Configurar el Servidor Web Nginx
Crea un archivo de configuración para tu sitio:
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

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Redirección opcional para tu Backend API personalizado (si lo creas en el puerto 5000)
    # location /api/ {
    #     proxy_pass http://localhost:5000/;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection 'upgrade';
    #     proxy_set_header Host $host;
    #     proxy_cache_bypass $http_upgrade;
    # }

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

## 5. Cómo Subir el Proyecto a tu GitHub (Desde tu Computadora Local)

Ejecuta estos comandos en tu terminal local (PowerShell) dentro de `C:\Users\abdia\OneDrive\Desktop\angelitas-pos-flow`:

1.  **Inicializar Git**:
    ```powershell
    git init
    ```
2.  **Añadir todos los archivos**:
    ```powershell
    git add .
    ```
3.  **Hacer el primer Commit**:
    ```powershell
    git commit -m "Initial commit - Angelitas POS flow funcional"
    ```
4.  **Vincular a tu repositorio de GitHub**:
    *Crea un repositorio vacío en tu cuenta de GitHub (ej: `angelitas-pos-flow`) y copia el enlace HTTPS:*
    ```powershell
    git branch -M main
    git remote add origin https://github.com/TU_USUARIO/angelitas-pos-flow.git
    ```
5.  **Subir el código**:
    ```powershell
    git push -u origin main
    ```
