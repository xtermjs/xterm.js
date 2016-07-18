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

- If the problem can not be reproduced in the [demo of xterm.js](README.md#demo), please provide an HTML document that demonstrates the problem.

- Be polite. Issues with an indignant or belligerent tone tend to be moved to the
  bottom of the pile.

## Contributing code

- Make sure you have a [GitHub account](https://github.com/join)
- Fork [xterm.js](https://github.com/sourcelair/xterm.js/)
  ([how to fork a repo](https://help.github.com/articles/fork-a-repo))
- Make your changes
- If your changes are easy to test or likely to regress, add tests. Tests go into `test`, directory.
- Follow the general code style of the rest of the project (see below).
- Submit a pull request
([how to create a pull request](https://help.github.com/articles/fork-a-repo)).
  Don't put more than one feature/fix in a single pull request.

By contributing code to xterm.js you

 - agree to license the contributed code under xterm.js' [MIT
   license](LICENSE).

 - confirm that you have the right to contribute and license the code
   in question. (Either you hold all rights on the code, or the rights
   holder has explicitly granted the right to use it like this,
   through a compatible open source license or through a direct
   agreement with you.)
