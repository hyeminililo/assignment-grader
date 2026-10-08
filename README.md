# Assignment Grader

React + TypeScript frontend and Node.js + TypeScript backend for grading Eclipse ZIP submissions by execution results.

## Run

### First-time setup

```bash
npm install
npx playwright install chromium
```

Docker Desktop must be installed and running for Java grading.

Check Docker:

```bash
docker --version
docker run --rm hello-world
```

### Daily run

1. Start Docker Desktop.

```bash
open /Applications/Docker.app
```

Wait until Docker Desktop is fully running. Then check:

```bash
docker info
```

2. Open the project in Visual Studio Code.

```bash
code /Users/hyem/assignment-grader
```

If the `code` command is unavailable, open VS Code and use:

```text
File -> Open Folder -> /Users/hyem/assignment-grader
```

3. Open a VS Code terminal.

```text
Terminal -> New Terminal
```

Make sure the terminal is in the project directory:

```bash
pwd
```

Expected:

```text
/Users/hyem/assignment-grader
```

If not:

```bash
cd /Users/hyem/assignment-grader
```

4. Start the app.

```bash
npm run dev
```

Open this URL in your browser:

```text
http://localhost:5173
```

Backend API runs at:

```text
http://localhost:4000
```

Java grading requires Docker and pulls/runs `eclipse-temurin:21-jdk` by default.
Set `JAVA_DOCKER_IMAGE` to override the image.

Example:

```bash
JAVA_DOCKER_IMAGE=eclipse-temurin:21-jdk npm run dev
```

## Troubleshooting

### `docker: command not found`

Docker Desktop is not installed, or the Docker CLI is not available in the terminal.

Install Docker Desktop, then restart the terminal.

### `Cannot connect to the Docker daemon`

Docker Desktop is not running yet.

Run:

```bash
open /Applications/Docker.app
```

Wait until Docker Desktop finishes starting, then retry:

```bash
docker info
```

### `openjdk:21-jdk-slim: not found`

This app uses `eclipse-temurin:21-jdk` by default because `openjdk:21-jdk-slim` is not currently available from Docker Hub.

### Port already in use

If port `5173` or `4000` is already being used, stop the other process or restart your terminal.

### Stop the app

In the terminal running `npm run dev`, press:

```text
Control + C
```

## Implemented MVP

- JAVA / WEB assignment setup
- Multiple problems per assignment
- Java test cases with `EXACT`, `NORMALIZED`, `CONTAINS`
- Safe ZIP extraction with ZIP Slip checks and extraction size limit
- Recursive project scanning without fixed Eclipse paths
- Java package/class/main parsing
- Docker-based Java compile/run with network disabled, memory, CPU, process, timeout, and stdout limits
- Web static rules with Cheerio
- Browser execution checks with Playwright and prompt automation
- SSE grading progress
- Result dashboard, detail view, source viewer
- Manual score adjustment with reason
- CSV export

## Security Notes

Student Java code is never executed on the Node host. ZIP entries are validated before extraction, temporary directories are isolated per submission, and cleanup runs in `finally` blocks.
