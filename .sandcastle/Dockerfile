# PROTOTYPE (DEV-251): throwaway Sandcastle sandbox image for the factory spike.
# Based on Sandcastle 0.14.0's Claude Code template, moved to Node 24 for MyVGC.
FROM node:24-bookworm

RUN apt-get update && apt-get install -y git curl jq \
  && rm -rf /var/lib/apt/lists/*

# GitHub CLI (Sandcastle requires gh in the image)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*

# pnpm as pinned in package.json
RUN npm install -g pnpm@10.28.0

# System libraries for Playwright 1.63.0's Chromium (pnpm screenshots)
RUN npx -y playwright@1.63.0 install-deps chromium

ARG AGENT_UID=1000
ARG AGENT_GID=1000
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node
USER ${AGENT_UID}:${AGENT_GID}

RUN curl -fsSL https://claude.ai/install.sh | bash
ENV PATH="/home/agent/.local/bin:$PATH"

RUN npx -y playwright@1.63.0 install chromium

WORKDIR /home/agent
ENTRYPOINT ["sleep", "infinity"]
