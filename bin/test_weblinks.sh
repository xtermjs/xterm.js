#!/bin/bash

# all half width
echo "aaa http://example.com aaa http://example.com aaa"

# full width before
echo "￥￥￥ http://example.com aaa http://example.com aaa"

# full width between
echo "aaa http://example.com ￥￥￥ http://example.com aaa"

# full width before and between
echo "￥￥￥ http://example.com ￥￥￥ http://example.com aaa"

# full width within url
echo "aaa https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문 aaa"

# full width within and before
echo "￥￥￥ https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문 ￥￥￥"

# username + password scheme
echo "http://test:password@example.com/some_path aaa"

# overly long text with urls with final interpunction
echo "Lorem ipsum dolor sit amet, consetetur sadipscing elitr https://ko.wikipedia.org/wiki/위키백과:대문, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Nam liber tempor cum soluta nobis eleifend option congue nihil imperdiet doming id quod mazim placerat facer possim assum. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat: http://test:password@example.com/some_path."

# bracket enclosed urls
echo "[http://example.de]"
echo "(http://example.de)"
echo "<http://example.de>"
echo "{http://example.de}"

# ipv6 scheme
echo "ipv6 https://[::1]/with/some?vars=and&a#hash"