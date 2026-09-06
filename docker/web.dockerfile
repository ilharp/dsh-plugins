FROM node:26.8.1-alpine3.23

WORKDIR /app

RUN ["npm", "install", "-g", "corepack"]
RUN ["corepack", "yarn"]
RUN ["corepack", "yarn", "workspace", "dsh-plugins-web", "build"]

FROM node:26.8.1-alpine3.23

WORKDIR /app

COPY --from=0 /app /app

ENTRYPOINT ["npm", "run", "start", "--workspace=dsh-plugins-web"]
