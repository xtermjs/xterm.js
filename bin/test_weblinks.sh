#!/bin/bash

# all half width - only good case
echo "aaa http://example.com aaa http://example.com aaa"

# full width before - wrong offset
echo "￥￥￥ http://example.com aaa http://example.com aaa"

# full width between - wrong offset
echo "aaa http://example.com ￥￥￥ http://example.com aaa"

# full width before and between - error in offsets adding up
echo "￥￥￥ http://example.com ￥￥￥ http://example.com aaa"

# full width within url - partial wrong match
echo "aaa https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문"

# full width within and before - partial wrong match + wrong offsets
echo "￥￥￥ https://ko.wikipedia.org/wiki/위키백과:대문 aaa https://ko.wikipedia.org/wiki/위키백과:대문"

# not matching at all
echo "http://test:password@example.com/some_path"
