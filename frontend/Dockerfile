FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build

# Use nginx to serve the static files
FROM nginx:alpine

COPY --from=0 /app/build /usr/share/nginx/html

# Add nginx configuration
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

# Use environment variable substitution
ENV BACKEND_URL=http://localhost:5000
ENV COOKIE_DOMAIN=localhost

CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL} ${COOKIE_DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"] 