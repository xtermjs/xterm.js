"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircularList = void 0;
const Lifecycle_1 = require("common/base/Lifecycle");
const Event_1 = require("common/base/Event");
class CircularList extends Lifecycle_1.Disposable {
    constructor(_maxLength) {
        super();
        this._maxLength = _maxLength;
        this.onDeleteEmitter = this._register(new Event_1.Emitter());
        this.onDelete = this.onDeleteEmitter.event;
        this.onInsertEmitter = this._register(new Event_1.Emitter());
        this.onInsert = this.onInsertEmitter.event;
        this.onTrimEmitter = this._register(new Event_1.Emitter());
        this.onTrim = this.onTrimEmitter.event;
        this._array = new Array(this._maxLength);
        this._startIndex = 0;
        this._length = 0;
    }
    get maxLength() {
        return this._maxLength;
    }
    set maxLength(newMaxLength) {
        if (this._maxLength === newMaxLength) {
            return;
        }
        const newArray = new Array(newMaxLength);
        for (let i = 0; i < Math.min(newMaxLength, this.length); i++) {
            newArray[i] = this._array[this._getCyclicIndex(i)];
        }
        this._array = newArray;
        this._maxLength = newMaxLength;
        this._startIndex = 0;
    }
    get length() {
        return this._length;
    }
    set length(newLength) {
        if (newLength > this._length) {
            for (let i = this._length; i < newLength; i++) {
                this._array[i] = undefined;
            }
        }
        this._length = newLength;
    }
    get(index) {
        return this._array[this._getCyclicIndex(index)];
    }
    set(index, value) {
        this._array[this._getCyclicIndex(index)] = value;
    }
    push(value) {
        this._array[this._getCyclicIndex(this._length)] = value;
        if (this._length === this._maxLength) {
            this._startIndex = ++this._startIndex % this._maxLength;
            this.onTrimEmitter.fire(1);
        }
        else {
            this._length++;
        }
    }
    recycle() {
        if (this._length !== this._maxLength) {
            throw new Error('Can only recycle when the buffer is full');
        }
        this._startIndex = ++this._startIndex % this._maxLength;
        this.onTrimEmitter.fire(1);
        return this._array[this._getCyclicIndex(this._length - 1)];
    }
    get isFull() {
        return this._length === this._maxLength;
    }
    pop() {
        return this._array[this._getCyclicIndex(this._length-- - 1)];
    }
    splice(start, deleteCount, ...items) {
        if (deleteCount) {
            for (let i = start; i < this._length - deleteCount; i++) {
                this._array[this._getCyclicIndex(i)] = this._array[this._getCyclicIndex(i + deleteCount)];
            }
            this._length -= deleteCount;
            this.onDeleteEmitter.fire({ index: start, amount: deleteCount });
        }
        for (let i = this._length - 1; i >= start; i--) {
            this._array[this._getCyclicIndex(i + items.length)] = this._array[this._getCyclicIndex(i)];
        }
        for (let i = 0; i < items.length; i++) {
            this._array[this._getCyclicIndex(start + i)] = items[i];
        }
        if (items.length) {
            this.onInsertEmitter.fire({ index: start, amount: items.length });
        }
        if (this._length + items.length > this._maxLength) {
            const countToTrim = (this._length + items.length) - this._maxLength;
            this._startIndex += countToTrim;
            this._length = this._maxLength;
            this.onTrimEmitter.fire(countToTrim);
        }
        else {
            this._length += items.length;
        }
    }
    trimStart(count) {
        if (count > this._length) {
            count = this._length;
        }
        this._startIndex += count;
        this._length -= count;
        this.onTrimEmitter.fire(count);
    }
    shiftElements(start, count, offset) {
        if (count <= 0) {
            return;
        }
        if (start < 0 || start >= this._length) {
            throw new Error('start argument out of range');
        }
        if (start + offset < 0) {
            throw new Error('Cannot shift elements in list beyond index 0');
        }
        if (offset > 0) {
            for (let i = count - 1; i >= 0; i--) {
                this.set(start + i + offset, this.get(start + i));
            }
            const expandListBy = (start + count + offset) - this._length;
            if (expandListBy > 0) {
                this._length += expandListBy;
                while (this._length > this._maxLength) {
                    this._length--;
                    this._startIndex++;
                    this.onTrimEmitter.fire(1);
                }
            }
        }
        else {
            for (let i = 0; i < count; i++) {
                this.set(start + i + offset, this.get(start + i));
            }
        }
    }
    _getCyclicIndex(index) {
        return (this._startIndex + index) % this._maxLength;
    }
}
exports.CircularList = CircularList;
//# sourceMappingURL=CircularList.js.map