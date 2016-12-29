FROM node:6.9
MAINTAINER Paris Kasidiaris <paris@sourcelair.com>

# Install cpio, used for building
RUN apt-get update \
    && apt-get install -y --no-install-recommends cpio \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Set an entrypoint, to automatically install node modules
ENTRYPOINT ["/bin/bash", "-c", "if [[ ! -d node_modules ]]; then npm install; fi; exec \"${@:0}\";"]
CMD ["npm", "run", "dev"]

# First, install dependencies to improve layer caching
COPY package.json /usr/src/app/
RUN npm install

# Add the code
COPY . /usr/src/app

# Run the tests and build, to make sure everything is working nicely
RUN npm run build && npm run test
