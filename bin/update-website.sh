#!/bin/sh

# Name the arguments
VERSION=$1

# Clone docs repo and update the documentation
git clone https://github.com/xtermjs/xtermjs.org
cd xtermjs.org
yarn
./bin/update-docs

# Add changes to index and only proceed if there are changes to commit
touch test-file
git add .
if ! git diff-index --quiet HEAD --; then

  # Delete the upstream branch if it exists for some reason
  export BRANCH_NAME=update-$VERSION
  git branch -D $BRANCH_NAME || true
  git push origin :$BRANCH_NAME || true

  # Create commit and push it to update-x.y.z
  git checkout -b $BRANCH_NAME
  git config --global user.name Daniel Imms
  git config --global user.email tyriar@tyriar.com
  git commit -m 'Update docs for v$VERSION'
  git push --set-upstream origin update-4.2.0
  git push -f

  # Create a PR in the GitHub repo
  curl \
    -H "Authorization: token $GITHUB_TOKEN" \
    -X POST \
    -d "{\"title\":\"Update docs for v$VERSION\",\"base\":\"master\",\"head\":\"xtermjs:$BRANCH_NAME\"}" \
    https://api.github.com/repos/xtermjs/xtermjs.org/pulls

else

  echo "No changes to commit"

fi
