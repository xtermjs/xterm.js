# How to contribute to xterm.js

- [Contributing code](#contributing-code)
- [Opening issues](#opening-issues)
- [Answering discussion questions](#answering-discussion-questions)

## Contributing code

You can find issues to work on by looking at issues labeled with [help wanted](https://github.com/xtermjs/xterm.js/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) or [good first issue](https://github.com/xtermjs/xterm.js/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). It's a good idea to comment on the issue saying that you're looking into it, just in case someone else comes along and you duplicate work. Once you have your issue, here are the steps to contribute:

- Fork [xterm.js](https://github.com/xtermjs/xterm.js/) ([how to fork a repo](https://help.github.com/articles/fork-a-repo)).
- Get the [xterm.js demo](https://github.com/xtermjs/xterm.js/wiki/Contributing#running-the-demo) running.
- Make the fix and verify it works in the demo. Be sure to follow thew general code style of the rest of the project.
- If your changes are easy to test or likely to regress in the future, add tests. These could be unit or integration (playwright) tests.
- Submit a pull request ([how to create a pull request](https://help.github.com/articles/fork-a-repo)).

> ![TIP]
> Don't put more than one feature or fix in a single pull request. The smaller pull requests are the easier they are to review and merge.

By contributing code to xterm.js you:

 - Agree to license the contributed code under xterm.js' [MIT license](LICENSE).
 - Confirm that you have the right to contribute and license the code in question. This means that either you hold all rights on the code, or the rights holder has explicitly granted the right to use it like this, through a compatible open source license or through a direct agreement with you.

## Opening issues

The preferred way to report bugs or request features is to use
[GitHub issues](http://github.com/xtermjs/xterm.js/issues).

### Creating great issues

- Include information about **the browser in which the problem occurred** or the terminal being used. If you tested several browsers and the problem occurred in all of them, mention this fact in the bug report. Also include browser version numbers and the operating system that you're on.
- Include the version of xterm.js being used, preferably either with the latest `beta` tagged release on npm or reproducing in the demo on the `master` branch.
- Mention precisely what went wrong. What did you expect to happen? What happened instead? Describe the exact steps a maintainer has to take to make the problem occur.
- If the problem can not be reproduced in the [demo of xterm.js](https://github.com/xtermjs/xterm.js/wiki/Contributing#running-the-demo), provide an HTML document that demonstrates the problem.
- Be polite and follow [the code of conduct](https://github.com/xtermjs/xterm.js?tab=coc-ov-file#readme).

### Issue triaging philosophy

It's pretty common for maintainers of large open source projects to suffer from burnout, especially when needing to triage a large number of incoming issues instead of actually building things. Here are some of the steps we take to try mitigate this:

- Support questions live in [GH discussions](https://github.com/xtermjs/xterm.js/discussions), issues may be transfered there without further comment and core maintainers may or may not participate in discussions.
- Issues are strictly for well defined features or bugs that are _actionable_.
- Sometimes features are out of scope. A common example of this is a niche feature that the pricipal implementation ([VS Code](https://code.visualstudio.com/)) won't leverage and therefore would be difficult to maintain and likely suffer from bitrot. The reporter may not agree with this, but you could always create an addon if that works or maintain your own fork if it comes to that.
- If a feature does not have a clear way forward or needs more discussion it may be closed ro moved to a discussion.
- If a bug is not easily reproducible it may be closed or moved to a discussion. Generally issues that are labeled are something we want to do or has actionable steps to look into further.

## Answering discussion questions

Issues are only meant to track (likely) feature requests and bugs. We use [GitHub Discussions](https://github.com/xtermjs/xterm.js/discussions) for general Q&A as well as discussing possible features. If you want to help out, many questions get asked over at the [discussions page](https://github.com/xtermjs/xterm.js/discussions) which could use an expert as the core team is often stretched thin.