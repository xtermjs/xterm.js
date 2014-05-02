-------
Methods
-------

focus()
^^^^^^^
Sends focus to the terminal

blur()
^^^^^^
Blurs the Terminal

open(element)
^^^^
Open the Xterm terminal, inside the given element.

resize(x, y)
^^^^^^^^^^^^
Resize the terminal, according to the given columns and rows.

insertRow(row)
^^^^^^^^^^^^^^
Insert the given row in the terminal.

on(event, callback)
^^^^^^^^^^^^^^^^^^^
Hook the given callback, to the given event.

off(event, callback)
^^^^^^^^^^^^^^^^^^^
Remove the Hook of the given callback, from the given event.

once(event, callback)
^^^^^^^^^^^^^^^^^^^
Hook the given callback to the given event, for just a single invocation.

write(data)
^^^^^^^^^^^
Write the given data to the terminal.

writeln(data)
^^^^^^^^^^^^^
Write the given data to the terminal, followed by a carriage return and a new line.

handler(data)
^^^^^^^^^^^^^
Fire the data event, for the given data.