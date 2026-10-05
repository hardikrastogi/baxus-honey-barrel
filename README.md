# The Honey Barrel

[![Demo Video](https://img.youtube.com/vi/IeYtkG17xk0/0.jpg)](https://youtu.be/IeYtkG17xk0)
[Watch the Demo Video](https://youtu.be/IeYtkG17xk0)

## Description

A Chrome extension that scrapes whisky/wine bottle information from e-commerce and retail websites, then cross-references with the BAXUS marketplace to determine if the same bottles are available at better prices.

> Based on the original extension by [mayank-dev07](https://github.com/mayank-dev07/baxus). This version removes an obfuscated backdoor that was hidden in `tailwind.config.js` and fixes 10 bugs. See [ARCHITECTURE.md](ARCHITECTURE.md) for the architecture, the security write-up, and the list of fixes.

## Installation

1. Clone the repository

   ```bash
   git clone https://github.com/hardikrastogi/baxus-honey-barrel.git
   cd baxus-honey-barrel
   ```

2. Install dependencies

   ```bash
   npm install
   ```

3. Build the extension

   ```bash
   npm run build
   ```

4. Load the extension in Chrome
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the `dist` directory from this project

## Usage Guide

### Building for Production

Create a production build of your extension:

```bash
npm run build
```

The built extension will be located in the `dist` directory, ready to be loaded into Chrome or published to the Chrome Web Store.

### Project Structure

- `src/` - Source code for the extension
  - `chrome-extension/` - Chrome-specific extension files
  - `components/` - React components
  - `lib/` - Utility functions and shared code
  - `public/` - Static assets

<!-- ## Technologies Used

- [React](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript
- [Vite](https://vitejs.dev/) - Build tool and development server
- [TailwindCSS](https://tailwindcss.com/) - Utility-first CSS framework
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/reference/) - Browser extension APIs
- [class-variance-authority](https://cva.style/docs) - Creating consistent component APIs
- [Lucide React](https://lucide.dev/) - Icon library -->

<!-- ## Contributing Guidelines

1. Fork the repository
2. Create a feature branch
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. Commit your changes
   ```bash
   git commit -m 'Add some amazing feature'
   ```
4. Push to the branch
   ```bash
   git push origin feature/amazing-feature
   ```
5. Open a Pull Request

### Code Style

This project uses ESLint to enforce code style. Before submitting a pull request, please make sure your code passes the linting checks by running:

```bash
npm run lint
``` -->
