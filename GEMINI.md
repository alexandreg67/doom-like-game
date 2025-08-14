# GEMINI.md

## Project Overview

This is a modern, web-based First-Person Shooter (FPS) game inspired by the classic 1993 DOOM. It is built using a TypeScript monorepo architecture, with [pnpm](https://pnpm.io/) managing the workspaces.

The core of the project is a 3D rendering engine built on top of [Babylon.js](https://www.babylonjs.com/), with support for WebGPU and WebGL2. The game logic is structured using an Entity-Component-System (ECS) pattern. The project also includes a web-based map editor for creating custom levels.

The monorepo is organized into `packages` and `apps`:
-   **`packages`**: Contains the core reusable modules:
    -   `engine`: The 3D rendering engine.
    -   `game-logic`: The ECS-based game logic.
    -   `map-editor`: The web-based level editor.
    -   `assets`: Asset pipeline and WAD-like format.
-   **`apps`**: Contains the deployable applications:
    -   `web`: The main web application that brings all the packages together.
    -   `docs`: A documentation site.

## Building and Running

The project uses `pnpm` for package management and running scripts.

### Key Commands

-   **Install dependencies:**
    ```bash
    pnpm install
    ```
-   **Start the development server:**
    ```bash
    pnpm dev
    ```
    This will start the web application on `http://localhost:5173`.

-   **Build all packages:**
    ```bash
    pnpm build
    ```
-   **Run unit tests:**
    ```bash
    pnpm test
    ```
-   **Run End-to-End (E2E) tests:**
    ```bash
    pnpm test:e2e
    ```
-   **Lint and format code:**
    ```bash
    pnpm lint
    pnpm format
    ```
-   **Type-check the code:**
    ```bash
    pnpm typecheck
    ```

## Development Conventions

-   **Monorepo:** The project is a monorepo, with shared dependencies and scripts managed by `pnpm`.
-   **TypeScript:** All code is written in TypeScript.
-   **ECS:** The game logic is built around an Entity-Component-System architecture.
-   **Styling:** The project uses [Biome](https://biomejs.dev/) for code formatting and linting.
-   **Testing:** Unit tests are written with [Vitest](https://vitest.dev/), and E2E tests are written with [Playwright](https://playwright.dev/).
-   **Continuous Integration:** The project has a CI pipeline configured in `.github/workflows/ci.yml`.
-   **Contributing:** Contribution guidelines are available in `CONTRIBUTING.md`.
