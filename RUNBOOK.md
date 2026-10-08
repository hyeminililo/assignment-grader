# Assignment Grader Runbook

This is the quick checklist for running the grader by yourself.

## Apps To Open

1. Docker Desktop
2. Visual Studio Code
3. Browser

## Every Time You Run It

### 1. Start Docker

Open Docker Desktop from Launchpad, or run:

```bash
open /Applications/Docker.app
```

Check that Docker is ready:

```bash
docker info
```

If this command prints Docker information, Java grading is ready.

### 2. Open The Project

Project folder:

```text
/Users/hyem/assignment-grader
```

Open with VS Code:

```bash
code /Users/hyem/assignment-grader
```

Or in VS Code:

```text
File -> Open Folder -> /Users/hyem/assignment-grader
```

### 3. Start The Program

In VS Code:

```text
Terminal -> New Terminal
```

Run:

```bash
cd /Users/hyem/assignment-grader
npm run dev
```

### 4. Open In Browser

Go to:

```text
http://localhost:5173
```

## When You Are Done

### 1. Stop The Program

In the terminal running the app, press:

```text
Control + C
```

If the terminal asks whether to terminate the batch/job, answer `y`.

Check that the frontend and backend are no longer responding:

```bash
curl -I http://localhost:5173
curl -I http://localhost:4000
```

It is okay if these commands fail with a connection error after the app is stopped.

### 2. Close The Project

Close the browser tab for:

```text
http://localhost:5173
```

In VS Code, close the project window or use:

```text
File -> Close Window
```

### 3. Stop Docker

If you are done grading Java assignments, quit Docker Desktop:

```text
Docker Desktop menu -> Quit Docker Desktop
```

You can also check whether any containers are still running:

```bash
docker ps
```

The grader runs Java submissions in temporary Docker containers. Normally there should be no grader containers left after grading finishes.

### 4. Optional Cleanup

The app removes uploaded ZIP files and temporary extraction folders after each grading job. If the app was force-quit during grading, you can check these folders later:

```text
/Users/hyem/assignment-grader/uploads
/tmp
```

Only remove files if you are sure they are temporary grader files.

## Common Problems

### Docker Is Not Ready

If you see:

```text
Cannot connect to the Docker daemon
```

Open Docker Desktop and wait until it finishes starting.

### Java Grading Does Not Work

Check:

```bash
docker info
docker run --rm eclipse-temurin:21-jdk java -version
```

Both commands should work.

### Browser Page Does Not Open

Make sure `npm run dev` is still running.

The frontend URL is:

```text
http://localhost:5173
```

The backend API URL is:

```text
http://localhost:4000
```

### Port Is Already In Use

If `npm run dev` says that port `5173` or `4000` is already in use, another copy of the app may still be running.

Close the old terminal or press `Control + C` in the terminal that is running the app, then run:

```bash
npm run dev
```
