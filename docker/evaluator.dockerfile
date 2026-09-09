FROM node:26.8.1-trixie-slim

WORKDIR /evaluator

COPY . /evaluator

RUN ["apt", "update"]
RUN ["apt", "install", "-y", "build-essential", "python3", "git"]
RUN ["npm", "install", "-g", "corepack"]
RUN ["corepack", "yarn"]
RUN ["git", "clone", "https://github.com/deepseek-ai/deepseek-harness.git", "/dsh"]

WORKDIR /dsh

RUN ["corepack", "pnpm", "i"]

WORKDIR /evaluator

ENTRYPOINT ["corepack", "yarn", "workspace", "dsh-plugins-evaluator", "start"]
