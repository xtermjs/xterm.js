# How to contribute to xterm.js

- [Opening issues for bug reports or feature requests](#opening-issues)
- [Contributing code](#contributing-code)

## Opening issues

The preferred way to report bugs or request features is to use
[GitHub issues](http://github.com/sourcelair/xterm.js/issues). Before
opening an issue, read these pointers.

### Opening issues effectively

- Include information about **the browser in which the problem occurred**. Even
  if you tested several browsers, and the problem occurred in all of them,
  mention this fact in the bug report. Also include browser version numbers and
  the operating system that you're on.

- Mention which release of xterm.js you're using. Preferably, try also with
  the current HEAD of the master branch, to ensure the problem has not already been
  fixed.

- Mention precisely what went wrong. What did you expect to happen? What happened instead? Describe the
  exact steps a maintainer has to take to make the problem occur.

- If the problem can not be reproduced in the [demo of xterm.js](https://github.com/xtermjs/xterm.js/wiki/Contributing#running-the-demo), please provide an HTML document that demonstrates the problem.

- Be polite. Issues with an indignant or belligerent tone tend to be moved to the
  bottom of the pile.

## Answering discussion questions

Issues are only meant to track (likely) feature requests and bugs. We use [GitHub Discussions](https://github.com/xtermjs/xterm.js/discussions) for general Q&A as well as discussing possible features. If you want to help out, many questions get asked over at the [discussions page](https://github.com/xtermjs/xterm.js/discussions) which could use an expert as the core team is often stretched thin.

## Contributing code

You can find issues to work on by looking at the [help wanted](https://github.com/xtermjs/xterm.js/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) or [good first issue](https://github.com/xtermjs/xterm.js/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) issues. It's a good idea to comment on the issue saying that you're taking it, just in case someone else comes along and you duplicate work. Once you have your issue, here are the steps to contribute:

- Fork [xterm.js](https://github.com/sourcelair/xterm.js/)
  ([how to fork a repo](https://help.github.com/articles/fork-a-repo)).
- Get the [xterm.js demo](https://github.com/xtermjs/xterm.js/wiki/Contributing#running-the-demo) running.
- Make your changes.
- If your changes are easy to test or likely to regress, add tests. Tests go into `test`, directory.
- Follow the general code style of the rest of the project (see below).
- Submit a pull request
([how to create a pull request](https://help.github.com/articles/fork-a-repo)).
  Don't put more than one feature/fix in a single pull request.

By contributing code to xterm.js you:

 - Agree to license the contributed code under xterm.js' [MIT
   license](LICENSE).

 - Confirm that you have the right to contribute and license the code
   in question. (Either you hold all rights on the code, or the rights
   holder has explicitly granted the right to use it like this,
   through a compatible open source license or through a direct
   agreement with you.)

### Test coverage

One area that always needs attention is improving out unit test coverage, you can view the code coverage report on [Azure Pipelines](https://dev.azure.com/xtermjs/xterm.js/_build/latest?definitionId=3) by clicking the Code Coverage tab.
