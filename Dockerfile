FROM node:6.9
MAINTAINER Paris Kasidiaris <paris@sourcelair.com>

# Install cpio, used for building
RUN apt-get update \
    && apt-get install -y --no-install-recommends cpio \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /usr/src/app

# Set an entrypoint, to automatically install node modules
COPY entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# First, install dependencies to improve layer caching
COPY package.json /usr/src/app/
RUN npm install

# Add the code
COPY . /usr/src/app

# Run the tests and build, to make sure everything is working nicely
RUN npm run test && npm run build
CMD ["npm", "run", "dev"]
