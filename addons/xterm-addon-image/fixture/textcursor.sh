#!/bin/bash

# Test cursor row, column placement after sixel image is sent.

# After a sixel image is displayed, the text cursor is moved to the
# row of the last sixel cursor position, but the column stays the same
# as it was before the sixel image was sent.
#
# This can be thought of as sixel images always ending with an
# implicit Graphics Carriage Return (`$`). 

# ADDENDUM: It is not as simple as I thought. When a row of sixels
# straddles two rows of text, the text cursor can be left on the upper row.
# It seems up to three lines of pixels may be beneath any words printed.
#
# The rule for when this happens is not obvious to me, but can be seen
# with images of height: 21, 22, 23, 24, 41, 42, 81, 82, 83, 84...
#
# My guess:
# for a sixel image of height h, let a=(h-1)%6 and b=(h-1)%20,
# then, the text will overlap the image when a>b.
#
# If that is the case, then the entire list of heights for which this
# will happen on the VT340's 480 pixel high screen is:
#
#  21  22  23  24   41  42   81  82  83  84
# 101 102  141 142 143 144  161 162 
# 201 202 203 204  221 222  261 262 263 264  281 282 
# 321 322 323 324  341 342  381 382 383 384
# 401 402  441 442 443 444  461 462
#
# Note that there are 48 entries, so that means there's a 10% chance
# if heights are chosen randomly from 1 to 480. However, if one were
# to always pick heights which are a multiple of the character cell
# height (20px), then the chances are 0% as there are no problematic
# heights divisible by 20. 


# Sixel images often do *not* end with a `-` (Graphics New Line = GNL)
# which sends the sixel cursor down 6 pixels. Any text printed next
# will potentially overlap the last row of sixels!

# I am not yet positive, but I believe that, in general, applications
# should send sixel images without a GNL but then send `^J`, a text
# newline (NL), before displaying more text or graphics.

# IMPORTANT: sometimes neither a graphics nor a text newline is wanted. 
# For example, if an image is full screen, either newline would cause
# the top line to scroll off the screen.

#         | Text cursor column | Text cursor row
# --------|--------------------|-------------------------------------
# !GNL !NL| Unchanged	       | Overlapping last line of graphics
# !GNL  NL| Column=1	       | First line immediately after graphic (usually)
#  GNL !NL| Unchanged	       | _Sometimes_ overlapping graphics
#  GNL  NL| Column=1	       | First *or* second line after graphic


CSI=$'\e['			# Control Sequence Introducer 
DCS=$'\eP'			# Device Control String
ST=$'\e\\'			# String Terminator

set_cursor_pos() {
    # Home, top left is row 1, col 1.
    local row=$1 col=$2
    echo -n ${CSI}${row}';'${col}'H'
}

reset_palette() {
    # Send DECRSTS to load colors from a Color Table Report
    echo -n ${DCS}'2$p'

    echo -n "0;2;0;0;0/"        # VT color #0 is black and BG text color

    echo -n "1;2;20;20;79/"	# VT color #1 is blue
    echo -n "2;2;79;13;13/"	# VT color #2 is red
    echo -n "3;2;20;79;20/"	# VT color #3 is green

    echo -n "4;2;79;20;79/"	# VT color #4 is magenta
    echo -n "5;2;20;79;79/"	# VT color #5 is cyan
    echo -n "6;2;79;79;20/"	# VT color #6 is yellow

    echo -n "7;2;46;46;46/"	# VT color #7 is gray 50% and FG text color
    echo -n "8;2;26;26;26/"	# VT color #8 is gray 25%

    echo -n "9;2;33;33;59/"	# VT color #9 is pastel blue
    echo -n "10;2;59;26;26/"	# VT color #10 is pastel red
    echo -n "11;2;33;59;33/"	# VT color #11 is pastel green

    echo -n "12;2;59;33;59/"	# VT color #12 is pastel magenta
    echo -n "13;2;33;59;59/"	# VT color #13 is pastel cyan
    echo -n "14;2;59;59;33/"	# VT color #14 is pastel yellow

    echo -n "15;2;79;79;79"	# VT color #15 is gray 75% and BOLD text color

    echo -n ${ST}		# String Terminator
}

# Generate square of size w with final graphics new line removed
square() {
    # Given a color index number and (optionally) a size, row, and column, 
    # draw a square with top left corner at (row, column) and of size×size px.
    # Default size 100×100px  (10cols, 5 rows)

    local -i color=${1:-1}	# Default is color index 1 (blue)
    local -i size=${2:-100}	# Size in pixels (defaults to 100)
    local -i row=$3 column=$4	# If set to 0, cursor is not moved

    if [[ row -ne 0 && column -ne 0 ]]; then
	set_cursor_pos $row $column
    fi

    # Draw a square of the right color & size 
    squaresize $color $size
}

squaresize() {
    # Helper for square() that uses convert to return a  sixel square of
    # the right color ($1) and size ($2).

    # Similar to this but with variable size squares:
    #    echo -n ${DCS}'0;0;0q"1;1;100;100#'${color}'!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100~-!100N'${ST}


    local color=${1:-1}			# Default color index is 1 (blue)
    local size=${2:-100}		# Default size is 100x100

    # Get a sixel string 
    local sq=$(convert -geometry ${size}x${size} xc:black sixel:-)

    # Remove ImageMagick's extraneous Graphic New Line at end of image.
    sq=${sq%-??}$'\e\\'

    # VT340s always used the same color register for the first sixel
    # color defined no matter what number it was assigned. That means,
    # each time we send a new sixel image, the previous one's color
    # palette gets changed. We don't want squares of all the same
    # color, so remove the color definition and just use the defaults.
    sq=${sq/\#0;2;0;0;0/}

    # And finally, switch to the proper index for the color we want.
    echo -n ${sq//\#0/#${color}}
}

squaregnl() {
    # Same as square(), but sends a graphics newline at the end of the sixels.
    # (Sticks a `-` before the String Terminator, "Esc \")
    sq=$(square "${@}")
    echo -n ${sq%??}$'-\e\\'
}


main() {
    clear
    reset_palette
    show_labels
    neither_graphic_nor_text 96 4 4 31 		# size, color, row, column
    text_newline_only 96 9 4 1
    text_newline_only 84 9 4 14
    graphics_new_line_only 100 1 4 51
    graphics_new_line_only 96 1 4 64
    set_cursor_pos 1000 1
}


neither_graphic_nor_text() {
    # Typically sixel images should not end with a Graphics New Line (GNL)
    # However, if a text newline isn't sent, there will be overlap.

    local -i size  color  row  column
    read size color row column <<<"$@"

    set_cursor_pos $((row++)) $column
    echo -n "Height $size"
    set_cursor_pos $((row++)) $column

    # Three squares sent as separate sixel images, indented +1 
    for i in {1..3}; do
	square $((color++)) $size
	tput cuf 1
    done

    echo -n "overlap?"
}


text_newline_only() {
    # USING A TEXT NEWLINE (NL) after an sixel image that does NOT
    # have GNL is probably the best way to be on the text line
    # immediately below the image. However, the text will still
    # occasionally overlap the last four rows of pixels.

    # Also, if multiple images are intended to be shown, there will
    # usually be a gap between them when using a text newline.

    # Overlap happens because the height of a text cell is 20 pixels
    # and the height of a sixel is 6. 
    # for (h=0; h<480; h++) if ((h-1)%6 > (h-1)%20 ) { h }

    # Let the pixel position of the top of the graphics cursor be 'Yg'
    # and let the pixel position of the top of the corresponding cell
    # of text which the text cursor will be placed on be 'Yt'. Note
    # that Yg is evenly divisible by 6 and Yt, by 20. Taking the
    # remainder, r, after dividing Yg by 20 tells us how many pixels
    # down into a row of text the last line of sixels started. When
    # r==0, the sixels started at the top of the text row.

    # When r = 14, the sixels covered the bottom six pixels on the row
    # of text. When 14 < r < 20, the sixel line impinged by r - 14
    # pixels into the text row below and there is a chance the next
    # text printed will overlap. 


    local -i size  color  row  column
    read size color row column <<<"$@"

    local -i offset
    offset=$((column-1))

    set_cursor_pos $row 1

    if ((offset)); then tput cuf $((offset)); fi
    echo "Height $size"

    # Three squares, separated by text new lines and indented +1 
    for i in {1..3}; do
	if ((offset)); then tput cuf $offset; fi
	square $((color++)) $size
	offset=offset+1
	echo
    done

    tput cuf $((offset))
    echo -n "overlap?"
}

graphics_new_line_only() {
    # However, some sixel images end with a `-`, a Graphics New Line.
    # This can be useful for writing another image starting at the same
    # column without having to reposition the cursor.
    #
    # However, this runs the risk of having occasional overlap.

    local -i size  color  row  column
    read size color row column <<<"$@"

    set_cursor_pos $((row++)) $column
    echo -n "Height $size"
    set_cursor_pos $((row++)) $column

    # Three squares, separated by graphics new lines and indented +1 
    for i in {1..3}; do
	squaregnl $((color++))  $size
	tput cuf 1
    done

    echo -n "overlap?"
}


show_labels() {
    set_cursor_pos 1 10
    echo -n "Should sixel images include a GNL ('-') at the end?"

    set_cursor_pos 3 29
    echo -n "Neither NL nor GNL"
    set_cursor_pos 3 1
    echo -n "Text New Line only"
    set_cursor_pos 3 51
    echo -n "Graphics New Line only"

    set_cursor_pos 22 29
    echo -n "Always overlaps"		# Neither NL nor GNL

    set_cursor_pos 22 3
    echo -n "Overlaps a little"		# NL only
    set_cursor_pos 23 3
    echo -n "    Gaps a little"		# NL only

    set_cursor_pos 22 54
    echo -n "Overlaps badly"		# GNL only
    set_cursor_pos 23 54
    echo -n "Never gaps"		# GNL only
}


main

