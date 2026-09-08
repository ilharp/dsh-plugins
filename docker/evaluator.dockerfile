FROM node:26.8.1-alpine3.23

WORKDIR /evaluator

COPY . /evaluator

RUN ["npm", "install", "-g", "corepack"]
RUN ["corepack", "yarn"]
RUN ["apk", "add", "--no-cache", "git"]
RUN ["git", "clone", "https://github.com/deepseek-ai/deepseek-harness.git", "/dsh"]

WORKDIR /dsh

RUN ["corepack", "pnpm", "i"]

WORKDIR /evaluator

ENTRYPOINT ["corepack", "yarn", "workspace", "dsh-plugins-evaluator", "start"]
