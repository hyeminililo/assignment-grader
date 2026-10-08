# 과제 채점기 실행 안내서

혼자서 채점기를 실행할 때 사용하는 빠른 체크리스트입니다.

## 열어야 할 앱

1. Docker Desktop
2. Visual Studio Code
3. 브라우저

## 실행할 때마다 할 일

### 1. Docker 시작하기

Launchpad에서 Docker Desktop을 열거나, 아래 명령어를 실행합니다.

```bash
open /Applications/Docker.app
```

Docker가 준비되었는지 확인합니다.

```bash
docker info
```

이 명령어가 Docker 정보를 출력하면 Java 채점 준비가 된 것입니다.

### 2. 프로젝트 열기

프로젝트 폴더:

```text
/Users/hyem/assignment-grader
```

VS Code로 열기:

```bash
code /Users/hyem/assignment-grader
```

또는 VS Code에서 아래 경로를 엽니다.

```text
File -> Open Folder -> /Users/hyem/assignment-grader
```

### 3. 프로그램 시작하기

VS Code에서 새 터미널을 엽니다.

```text
Terminal -> New Terminal
```

아래 명령어를 실행합니다.

```bash
cd /Users/hyem/assignment-grader
npm run dev
```

### 4. 브라우저에서 열기

아래 주소로 이동합니다.

```text
http://localhost:5173
```

## 사용을 마쳤을 때

### 1. 프로그램 종료하기

앱이 실행 중인 터미널에서 아래 키를 누릅니다.

```text
Control + C
```

터미널에서 종료할지 묻는 메시지가 나오면 `y`를 입력합니다.

프론트엔드와 백엔드가 더 이상 응답하지 않는지 확인하려면 아래 명령어를 실행합니다.

```bash
curl -I http://localhost:5173
curl -I http://localhost:4000
```

앱을 종료한 뒤에는 연결 오류가 나와도 정상입니다.

### 2. 프로젝트 닫기

브라우저에서 아래 탭을 닫습니다.

```text
http://localhost:5173
```

VS Code에서는 프로젝트 창을 닫거나 아래 메뉴를 사용합니다.

```text
File -> Close Window
```

### 3. Docker 종료하기

Java 과제 채점을 모두 마쳤다면 Docker Desktop을 종료해도 됩니다.

```text
Docker Desktop 메뉴 > Quit Docker Desktop
```

아직 실행 중인 컨테이너가 있는지 확인하려면 아래 명령어를 사용합니다.

```bash
docker ps
```

이 채점기는 Java 제출물을 임시 Docker 컨테이너에서 실행합니다. 보통 채점이 끝난 뒤에는 남아 있는 채점기 컨테이너가 없어야 합니다.

### 4. 선택 사항: 임시 파일 확인

앱은 각 채점 작업이 끝나면 업로드된 ZIP 파일과 임시 압축 해제 폴더를 정리합니다. 채점 중에 앱을 강제 종료했다면 나중에 아래 위치를 확인할 수 있습니다.

```text
/Users/hyem/assignment-grader/uploads
/tmp
```

확실히 임시 채점 파일이라고 판단되는 파일만 삭제하세요.

## 자주 생기는 문제

### Docker가 준비되지 않았을 때

아래 메시지가 보이면:

```text
Cannot connect to the Docker daemon
```

Docker Desktop을 열고 시작이 끝날 때까지 기다립니다.

### Java 채점이 작동하지 않을 때

아래 명령어를 확인합니다.

```bash
docker info
docker run --rm eclipse-temurin:21-jdk java -version
```

두 명령어 모두 정상적으로 실행되어야 합니다.

### 브라우저 페이지가 열리지 않을 때

`npm run dev`가 아직 실행 중인지 확인합니다.

프론트엔드 주소:

```text
http://localhost:5173
```

백엔드 API 주소:

```text
http://localhost:4000
```

### 포트가 이미 사용 중일 때

`npm run dev` 실행 시 `5173` 또는 `4000` 포트가 이미 사용 중이라는 메시지가 나오면 이전에 실행한 앱이 아직 켜져 있을 수 있습니다.

앱이 실행 중인 기존 터미널에서 `Control + C`를 누르거나 터미널을 닫은 뒤 다시 실행합니다.

```bash
npm run dev
```
