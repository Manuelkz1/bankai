# 🚀 Configuración de Despliegue en Netlify

## Variables de Entorno Requeridas

Para que la aplicación funcione correctamente en Netlify, debes configurar las siguientes variables de entorno en el dashboard de Netlify:

### 🔧 Configurar en Netlify Dashboard:
1. Ve a tu proyecto en Netlify
2. Navega a Site settings > Environment variables
3. Agrega las siguientes variables:

```
VITE_SUPABASE_URL=https://xawsitihehpebojtkunk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhhd3NpdGloZWhwZWJvanRrdW5rIiwicm9sZSI6ImFub25fa2V5IiwiaWF0IjoxNzQyNDk4NzA2LCJleHAiOjIwNTgwNzQ3MDZ9.4TjN9P_J8kB6YNQdMWKpFYOq3ZI-yRKOeJEWRqM8hJo
```

### 🏗️ Configuración de Build:
- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 18 o superior

### 📁 Archivos importantes:
- `netlify.toml` - Configuración del sitio
- `public/_redirects` - Redirecciones para SPA
- `.env.example` - Ejemplo de variables de entorno

### 🔍 Solución de problemas:
Si la página sigue apareciendo en blanco:
1. Verifica que las variables de entorno estén configuradas
2. Revisa los logs de build en Netlify
3. Verifica que el comando de build sea `npm run build`
4. Asegúrate de que el directorio de publicación sea `dist`

### 🆘 Soporte:
Si necesitas ayuda adicional, revisa:
- Los logs de deploy en Netlify
- La consola del navegador para errores JavaScript
- Que Supabase esté funcionando correctamente
