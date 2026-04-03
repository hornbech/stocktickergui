# Stage 1: Build Angular frontend
FROM node:22-alpine AS frontend-build
WORKDIR /app
RUN npm install -g @angular/cli@19
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npx ng build --configuration=production

# Stage 2: Install proxy dependencies
FROM node:22-alpine AS proxy-deps
WORKDIR /app/proxy
COPY proxy/package.json proxy/package-lock.json* ./
RUN npm install --omit=dev

# Stage 3: Runtime
FROM node:22-alpine
RUN apk add --no-cache nginx

# Copy built Angular app
COPY --from=frontend-build /app/dist/stockoverview/browser /usr/share/nginx/html

# Copy proxy
COPY --from=proxy-deps /app/proxy/node_modules /app/proxy/node_modules
COPY proxy/ /app/proxy/

# Copy nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

EXPOSE 80

# Start both proxy and nginx
CMD ["sh", "-c", "node /app/proxy/server.js & sleep 1 && nginx -g 'daemon off;'"]
