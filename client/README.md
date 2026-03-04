# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## ChatPage E2E Tests (Playwright)

This client includes a mocked E2E suite for `ChatPage` in `ChatPageTest/`.

What it covers:
- redirect from `/chat` to `/login` for unauthenticated users
- conversation list hydration and default thread selection
- thread switching behavior
- message send flow (HTTP fallback when socket is disconnected)
- right-click withdraw context menu for own messages
- no withdraw menu for non-owned messages

Run commands:

```bash
npx playwright install chromium
npm run test:e2e
```

Optional interactive runner:

```bash
npm run test:e2e:ui
```

Notes:
- tests run against the Vite dev server via Playwright `webServer`
- chat API routes are intercepted and mocked in `ChatPageTest/chatPage.mocks.js`
- backend/socket services are not required for this suite