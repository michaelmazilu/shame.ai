FROM mcr.microsoft.com/playwright:v1.52.0-noble

# Install Xvfb (virtual display), x11vnc (VNC server), noVNC (browser-based VNC client)
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    fluxbox \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .

# Playwright API port + noVNC web port
EXPOSE 3001 6080

ENV PORT=3001
ENV DISPLAY=:99
# Start script: Xvfb → fluxbox → x11vnc (no password) → noVNC (autoconnect) → node server
CMD bash -c "\
  Xvfb :99 -screen 0 1280x1024x24 -ac &\
  sleep 1 &&\
  fluxbox &\
  x11vnc -display :99 -nopw -forever -shared -rfbport 5900 &\
  websockify --web /usr/share/novnc 6080 localhost:5900 &\
  npm start"
