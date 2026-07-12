# Guía Actualizada de Despliegue en VPS (Hostinger) y Migración de Base de Datos
## Angelitas POS - Versión Autónoma y Optimizada

Esta guía contiene los pasos específicos para actualizar tu VPS de Hostinger a la nueva versión autónoma de la aplicación y migrar la base de datos optimizada con los nuevos usuarios.

---

## 1. Migración de la Base de Datos (Recomendado: Reemplazar por localhost)

Dado que la versión local contiene:
* Los 10 usuarios de producción registrados con contraseña inicial `123`.
* La nueva columna `email` creada en la tabla `user`.
* Todos los índices de rendimiento creados (`idx_inv_product_branch`, etc.) que aceleran el POS.

**Es altamente recomendable eliminar la base de datos anterior en el VPS e importar la de localhost.**

### Paso A: Exportar la Base de Datos desde Localhost
En tu computadora (donde tienes el servidor MySQL local activo), abre una terminal de CMD o PowerShell y ejecuta el siguiente comando para generar un respaldo completo de la base de datos actual con datos y estructura:
```bash
mysqldump -u root -p angelitas_pos > C:\Users\abdia\OneDrive\Desktop\angelitas-pos-flow-final\db_backup_optimizada.sql
```
*(Nota: Si no tienes contraseña en tu MySQL local, simplemente omite la `-p` o presiona Enter cuando te la pida).*

### Paso B: Subir e Importar el Respaldo al VPS
1. Sube el archivo `db_backup_optimizada.sql` a tu VPS vía SCP/SFTP o mediante git.
2. Accede a tu VPS por SSH e ingresa a MySQL para limpiar la base de datos anterior:
   ```bash
   ssh root@IP_DEL_VPS
   mysql -u root -p
   ```
3. Ejecuta los siguientes comandos en la consola de MySQL para eliminar y recrear la base de datos limpia:
   ```sql
   DROP DATABASE angelitas_pos;
   CREATE DATABASE angelitas_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   EXIT;
   ```
4. Importa el archivo optimizado que subiste:
   ```bash
   mysql -u root -p angelitas_pos < /ruta/a/db_backup_optimizada.sql
   ```
¡Listo! La base de datos en tu VPS ahora tendrá exactamente la estructura de índices de velocidad y todos tus usuarios listos para ingresar.

---

## 2. Actualización de Archivos en el VPS

### Paso A: El Backend (Node.js Express)
1. Sube la nueva carpeta `server/` a tu VPS (reemplazando la anterior, por ejemplo en `/var/www/angelitas-backend`).
2. Recuerda mantener tu archivo `.env` de producción del VPS intacto (con el puerto, credenciales de producción de MySQL del VPS y JWT secret).
3. Entra a la carpeta del backend en el VPS e instala las nuevas dependencias (como `compression`, `helmet` y `multer`):
   ```bash
   cd /var/www/angelitas-backend
   npm install --production
   ```
4. Reinicia el proceso de Node en segundo plano con **PM2** para que aplique los cambios:
   ```bash
   pm2 restart "angelitas-pos-backend"
   ```

### Paso B: El Frontend (React estático con Nginx)
1. Compila el frontend localmente en la carpeta `angelitas-pos-flow-final` ejecutando:
   ```bash
   npm run build
   ```
   *(Esto generará una carpeta `dist/` optimizada).*
2. Sube el contenido de la carpeta `dist/` a tu VPS (reemplazando los archivos en la ruta del servidor web, por ejemplo en `/var/www/angelitas-frontend`).
3. Recarga Nginx para asegurarte de que sirva la última versión estática:
   ```bash
   sudo systemctl reload nginx
   ```
