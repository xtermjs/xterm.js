#!/bin/bash

# GLF should move the text cursor downwards,
# even if no pixels were modified,
# when sixel scrolling is on.

echo -n $'\e[?80l'		# Ensure sixel scrolling is on (disable DECSDM)

clear
echo "A test of Sixel GLF (Graphics Line Feed) when sixel scrolling is on"
echo

# Move cursor down three using GLF ("-")
echo -e '\x1bPq$-$-$-$-\x1b\\'

# Show a single sixel line that says, "Your terminal ->"
cat <<'EOF'
P0;0;0q"1;1;244;21#0;2;0;0;0#1;2;80;80;80#0~~~NFFFN~~~n!4FN!68~NFN!64~bbb!42~rbbbBB!41~$#1???owwwo???O!4wo!68?owo!64?[[[!42?K[[[{{-#0!5~{woBFB`o{}!4~NFBpp!4xpbBF~~~x@@@~~~xxp@@!5~xxp@@b`pxwxpz!17~zpp???!5px!5~NFBpxxwxxpBBN!4~xxp@@b`pxwxpz~x@@@xxp@@pxx@@F!4~xppp@@!8~x@@@pxxwxp@B!5~zxXXXWXX@BF!10~??!24~!10^FNN^~~~$#1!5?BFN{w{]NB@!4?ow{MM!4EM[{w???E}}}???EEM}}!5?EEM}}[]MEFEMC!17?CMM~~~!5ME!5?ow{MEEFEEM{{o!4?EEM}}[]MEFEMC?E}}}EEM}}MEE}}w!4?EMMM}}!8?E}}}MEEFEM}{!5?CEeeefee}{w!10?~~!24?!10_woo_-#0!5~nFFF??FFN!5~wo_FF!4NFb_o!4~{o_!4Ffb??Fn~~~NFF??!4FN!23~_??!5NFFn~~~w__C!7KCC!4~NFF??!4FN!4~N???N~~??Fn~???N~~N!4F??!4Fn~~~F???Fn~~nF??Fn~~p??KMMMEE???Fn~~~N!4F??!4Fn!29~{{}!4~$#1!5?Owww~~wwo!5?FN^ww!4ow[^N!4?BN^!4wW[~~wO???oww~~!4wo!23?^~~!5owwO???F^^z!7rzz!4?oww~~!4wo!4?o~~~o??~~wO?~~~o??o!4w~~!4wO???w~~~wO??Ow~~wO??M~~rpppxx~~~wO???o!4w~~!4wO!29?BB@-#0!25FE!63FE!15FE!77FE!60F$#1!25?@!63?@!15?@!77?@-\
EOF

sleep 1
tput cup 2 30

# Show four lines saying, "<- A genuine VT340 would end here"
cat <<'EOF'
P0;0;0q"1;1;144;80#0;2;0;0;0#1;2;80;80;80#0~~rpp@@`@BN!25~!11^!5~^^^N^^^!6~!7^N^^^!5~!4^~~~!5^!6~^^^WWW!8~!7^N^^^!8~^^^N^^^!5~$#1??KMM}}]}{o!25?!11_!5?___o___!6?!7_o___!5?!4_???!5_!6?___fff!8?!7_o___!8?___o___-#0~~NB??EFE??@F^!19~B??{!4}{W??}}~~B@?K!5MK??B~~~}???{!4}{??!4~}???~~~}}{??!6~}{{{??!8~}???{!4}{??!4~B@?K!5MK??B~~$#1??o{~~xwx~~}w_!19?{~~B!4@Bf~~@@??{}~r!5pr~~{???@~~~B!4@B~~!4?@~~~???@@B~~!6?@BBB~~!8?@~~~B!4@B~~!4?{}~r!5pr~~{-#0rpoopr~~~zpooopr!17~}{ww!4pwW??!4~}wwprrb!4rpp~~~pooopz~~zpoopz!4~{w!4pxwoopz~~~r!4poo!4pz~~~pooopz~~zpoopz~~}wwprrb!4rpp~~$#1KMNNMK???CMNNNMK!17?@BFF!4MFf~~!4?@FFMKK[!4KMM???MNNNMC??CMNNMC!4?BF!4MEFNNMC???K!4MNN!4MC???MNNNMC??CMNNMC??@FFMKK[!4KMM-#0!32~^NNNKWwww[[MNNN^~!13N!5~NN!5FNN^!10~N!4F!8~NN!4FN^!36~$#1!32?_ooorfFFFbbpooo_?!13o!5?oo!5woo_!10?o!4w!8?oo!4wo_-#0!32~}{o?AM!4~E?_w}}~o_o}}???}}}__!5~}}~fFFFAOw!6~^FB_w{???!6~B??}!4~{??!35~$#1!32?@BN~|p!4?x~^F@@?N^N@@~~~@@@^^!5?@@?Wwww|nF!6?_w{^FB~~~!6?{~~@!4?B~~-#0!36~{_?FB?o}!7~^NN???NN^!6~!8NE?_x!4~poooP@@???X!5~{o?F!4NB_o!35~$#1!36?B^~w{~N@!7?_oo~~~oo_!6?!8ox~^E!4?MNNNm}}~~~e!5?BN~w!4o{^N-#0!38~}}}!11~!8}!8~!6}!13~!6}!9~!4}!38~$#1!38?@@@!11?!8@!8?!6@!13?!6@!9?!4@-#0!5^!5~!5^!5~!7^!6~!4^~~~!5^!6~{www??!11~^^^N^\W???!22~^^^N^^^!6~!7^N^^^!8~^^^N^\W???~~$#1!5_!5?!5_!5?!7_!6?!4_???!5_!6?BFFF~~!11?___o_af~~~!22?___o___!6?!7_o___!8?___o_af~~~-#0}{??CMB@@FM??o{~~B@?{{!4}{w?@~~~}???~~~}}{??!10~??!8~B??{!5}{???!19~B@?K!5MK??B~~~}???{!4}{??!4~B??{!5}{???~~$#1@B~~zp{}}wp~~NB??{}~BB!4@BF~}???@~~~???@@B~~!10?~~!8?{~~B!5@B~~~!19?{}~r!5pr~~{???@~~~B!4@B~~!4?{~~B!5@B~~~-#0~~~woow~}woo{!4~}{wpprbrrpww{!5~{w!4pxwoopz~~~r!4poo!4pz~~~}{ww!5pwooopz!17~}wwprrb!4rpp~~~pooopz~~zpoopz~~}{ww!5pwooopz$#1???FNNF?@FNNB!4?@BFMMK[KKMFFB!5?BF!4MEFNNMC???K!4MNN!4MC???@BFF!5MFNNNMC!17?@FFMKK[!4KMM???MNNNMC??CMNNMC??@BFF!5MFNNNMC-#0!40~n!4F!99~$#1!40?O!4w-#0!10~^^n!29~???b!4rbBF!4~^NFbrrprrbFF^!4~rrbBBFBbrrrbv~~^NFbrrprrbFF^!42~$#1!10?__O!29?~~~[!4K[{w!4?_ow[KKMKK[ww_!4?KK[{{w{[KKK[G??_ow[KKMKK[ww_-#0!9~}{wq!10}!18~N???N^~~^N??N^~~o??H!6XWGG!4~^NN??!4N^!5~o??H!6XWGG!42~$#1!9?@BFL!10@!18?o~~~o_??_o~~o_??N~~u!6efvv!4?_oo~~!4o_!5?N~~u!6efvv-#0!41B!6ABB!6A!5BAAA?!6A!4B!10A!8BAAA?!6A!42B$#1!41?!6@??!6@!5?@@@B!6@!4?!10@!8?@@@B!6@$-\This text should be indented.
EOF

# For more details, please see:
# https://github.com/jerch/xterm-addon-image/issues/37

# By default, sixel is in a 2:1 aspect ratio, which means
# every sixel graphics linefeed (GLF) adds another 12 pixels.
# With four GLFs, we have five sixel lines = 5 * 12 =  60 pixels.

# Which text line that ends up on depends upon the height of your
# font. On the VT340, the font is 20 pixels high. 

# On a VT340 sixel scrolling is on by default. DEC refers to this by
# two different names "sixel scrolling" and its negation, "DECSDM"
# (Sixel Display Mode). They control the same thing, so when DECSDM is
# on, sixel scrolling is off, and vice versa. 

# When DECSDM is on, the graphic line feeds do not affect the text cursor.


# How hackerb9 created the two sixel test images:
#
# convert -family "Courier" -style normal -density 72 -pointsize 26 -interline-spacing -12 -gravity center -fill gray80 -background none label:$'A genuine\nVT340\nwould end\n← here  '  +trim +dither -colors 2 sixel:- > reference.six
#
# convert -family "Courier" -style normal -density 72 -pointsize 26 -interline-spacing -12 -gravity center -fill gray80 -background none label:$'Your terminal →'  +trim -bordercolor none -border 2 +dither -colors 2 sixel:- > yourterminal.six

