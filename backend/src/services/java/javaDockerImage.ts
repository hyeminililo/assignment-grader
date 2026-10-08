export function javaDockerImage(): string {
  return process.env.JAVA_DOCKER_IMAGE ?? "eclipse-temurin:21-jdk";
}
