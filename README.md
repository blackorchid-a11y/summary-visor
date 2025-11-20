# 📚 Visor de Temas MIR

Una aplicación de escritorio para visualizar y estudiar temas del examen MIR (Médico Interno Residente).

## ✨ Características

- 📖 Visualización de temas médicos
- 🎨 Resaltado de texto con colores personalizables
- 💾 Almacenamiento local de tus anotaciones
- 🔍 Navegación sencilla entre temas
- 📱 Interfaz moderna y responsive

## 🚀 Instalación

### Descargar instaladores pre-compilados

Ve a la sección [Releases](https://github.com/blackorchid-a11y/summary-visor/releases) y descarga el instalador para tu sistema operativo:

- **Windows**: `Visor-Temas-MIR-Setup-*.exe`
- **macOS**: `Visor-Temas-MIR-*.dmg` (Intel y Apple Silicon)
- **Linux**: `Visor-Temas-MIR-*.AppImage` o `.deb`

### Compilar desde el código fuente

#### Requisitos previos
- Node.js 20 o superior
- npm

#### Pasos

1. Clona el repositorio:
```bash
git clone https://github.com/blackorchid-a11y/summary-visor.git
cd summary-visor
```

2. Instala las dependencias:
```bash
npm install
```

3. Compila la aplicación:
```bash
npm run electron:build
```

Los instaladores se generarán en la carpeta `dist-electron/`.

## 💻 Desarrollo

### Ejecutar en modo desarrollo

```bash
npm run dev
```

Esto iniciará el servidor de desarrollo de Vite.

Para ejecutar la aplicación Electron en modo desarrollo:

```bash
npm run electron
```

### Scripts disponibles

- `npm run dev` - Inicia el servidor de desarrollo
- `npm run build` - Compila el proyecto web
- `npm run electron:build` - Compila la aplicación de escritorio
- `npm run lint` - Ejecuta el linter

## 🛠️ Tecnologías utilizadas

- **Frontend**: React 19, Tailwind CSS 4, Framer Motion
- **Desktop**: Electron 39
- **Build**: Vite 7, electron-builder
- **Database**: IndexedDB (idb)
- **Diagramas**: Mermaid

## 📦 Estructura del proyecto

```
.
├── electron/          # Proceso principal de Electron
├── src/              # Código fuente React
│   ├── components/   # Componentes React
│   ├── lib/         # Utilidades y lógica de negocio
│   └── assets/      # Recursos estáticos
├── public/          # Archivos públicos
└── dist-electron/   # Build de la aplicación (generado)
```

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 🔧 CI/CD

Este proyecto utiliza GitHub Actions para compilar automáticamente la aplicación para Windows, macOS y Linux en cada push a la rama principal.

Para crear una nueva release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Esto activará automáticamente el workflow de GitHub Actions que compilará y publicará los instaladores.

## 📧 Contacto

Jorge - [@blackorchid-a11y](https://github.com/blackorchid-a11y)

Project Link: [https://github.com/blackorchid-a11y/summary-visor](https://github.com/blackorchid-a11y/summary-visor)
