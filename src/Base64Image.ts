import {IRenderDimensions} from './renderer/Types'
import { IRenderable } from './Types';
export interface StringMap { [s: string]: string; }

export class Base64Image {
  imageBase64: string
  width: number
  height: number
  format: string
  valid: boolean
  attrs: StringMap

  constructor(data:string) 
  {
    // replace all whitespace in data
    let data_ = data.replace(/\s/g,'')
    
    // split into attributes/encodedImage
    if (data_.indexOf(":") == -1) {
      this.valid = false
      return
    }
    let [attrStr, imageBase64] = data_.split(":", 2)
    this.imageBase64 = imageBase64

    // get the image format
    this.format = this.imageFormat(this.imageBase64)
    if (!this.format) {
      this.valid = false
      return
    }

    this.attrs = this.parseAttrs(attrStr)

    // determine image size
    let size = null;
    if (this.format == "png") {
      size = this.pngSize(atob(this.imageBase64))
    } else if (this.format == "jpeg") {
      size = this.jpegSize(atob(this.imageBase64))
    }

    if (!size) {
      this.valid = false
      return
    }
    this.width = size[0]
    this.height = size[1]
    this.valid = true
  }

  public dataUrl():string 
  {
    return "data:image/" + this.format + ";base64," + this.imageBase64
  } 

  public calculateDimensions(dimensions:IRenderDimensions): [number, number, number, number]
  {
    let width = this.getDimension(this.attrs['width'], 
                        this.width,
                        dimensions.scaledCellWidth, 
                        dimensions.scaledCanvasWidth)
    
    let height = this.getDimension(this.attrs['height'], 
                        this.height,
                        dimensions.scaledCellHeight, 
                        dimensions.scaledCanvasHeight - (dimensions.scaledCellHeight*2))

    if (this.attrs['preserveAspectRatio'] !== "0") {
      let scaleW = width/this.width
      let scaleH = height/this.height

      if (scaleW < scaleH) {
        height = Math.ceil(this.height*scaleW)
      } else {
        width = Math.ceil(this.width*scaleH)
      }
    }

    let nrows = Math.ceil(height/dimensions.scaledCellHeight)
    let ncols = Math.ceil(width/dimensions.scaledCellWidth)

    return [width, height, nrows, ncols]
  }

  public getImageData(img: HTMLImageElement, 
                     width:number, 
                     height:number, 
                     nrows:number, 
                     ncols:number, 
                     dimensions:IRenderDimensions) : ImageData[][]
  {
    let cellWidth = dimensions.scaledCellWidth
    let cellHeight = dimensions.scaledCellHeight

    // create a canvas that fits the grid
    let canvasWidth = ncols*cellWidth
    let canvasHeight = nrows*cellHeight

    let offscreenCanvas = document.createElement('canvas')
    offscreenCanvas.width = canvasWidth
    offscreenCanvas.height = canvasHeight

    let context = offscreenCanvas.getContext('2d')
    context.drawImage(img,0,0,width,height)

    // slice the image in a grid of nrows * ncols
    var res : ImageData[][] = []
    for(var i=0; i < nrows; i++) {
      res[i] = []
      for(var j=0; j < ncols; j++) {
        res[i][j] = context.getImageData(j*cellWidth, i*cellHeight, cellWidth, cellHeight)
      }
    }

    return res
  }

  private getDimension(attr:string, imgDim:number, unit:number, total:number) : number
  {
    var res:number = NaN
    if (attr.slice(-1) == '%') {
      res = Math.floor((parseFloat(attr.slice(0, -1))/100) * total)
    } else if (attr.slice(-2) == 'px') {
      res = parseInt(attr.slice(0, -2))
    } else if (attr != "auto") {
      res = parseInt(attr) * unit
    }
    return !isNaN(res) ? res : Math.min(imgDim, total)
  }

  private imageFormat(base64Encoded:string) : string | null {
    switch (base64Encoded.substr(0, 6)) {
      case "/9j/4A": return "jpeg"
      case "iVBORw": return "png"
      default: return null
    }
  }

  private parseAttrs(attrStr:string): StringMap {
    if (attrStr.lastIndexOf("File=", 0) !== 0) return {}
    attrStr = attrStr.substr("File=".length)
    // parse key=value; pairs
    var attrs : StringMap = {}
    attrStr.split(";").forEach(el => {
      if (el.lastIndexOf("=") !== -1) {
        let [k,v] = el.split("=")
        attrs[k] = v
      }
    });

    attrs['name'] = attrs['name'] || 'Unnamed file'
    attrs['width'] = attrs['width'] || 'auto'
    attrs['height'] = attrs['height'] || 'auto'
    attrs['preserveAspectRatio'] = attrs['preserveAspectRatio'] || '1'
    attrs['inline'] = attrs['inline'] || '0'
    
    return attrs
  }

    // https://stackoverflow.com/a/1532798
  private pngSize(data: string) : [number, number] {
    return [toInt32(data.slice(16, 20)),
            toInt32(data.slice(20, 24))]
  }

  private jpegSize(data:string) : [number, number] | null {
    // https://stackoverflow.com/questions/2517854/getting-image-size-of-jpeg-from-its-binary/48488655#48488655
    var off = 0;
    
    while(off<data.length) {
      while(data.charCodeAt(off)==0xff) off++;
      var mrkr = data.charCodeAt(off);  off++;
  
      if(mrkr==0xd8) continue;    // SOI
      if(mrkr==0xd9) break;       // EOI
      if(0xd0<=mrkr && mrkr<=0xd7) continue;
      if(mrkr==0x01) continue;    // TEM
  
      var len = ((data.charCodeAt(off)<<8)|data.charCodeAt(off+1))-2;  off+=2;  
  
      if(mrkr==0xc0) {
        let width = (data.charCodeAt(off+3)<<8)|data.charCodeAt(off+4)
        let height = (data.charCodeAt(off+1)<<8)|data.charCodeAt(off+2)
        return [width, height]
      }
      off+=len;
    }
    return null
  }
  
}

export class ImageCell implements IRenderable {
  imageData: ImageData
  _dataUrl: string

  constructor(imageData: ImageData, dataUrl: string) {
    this._dataUrl = dataUrl
    this.imageData = imageData
  }

  public dataUrl() {
    return this._dataUrl;
  }

  public drawBackground(ctx: CanvasRenderingContext2D, x: number, y: number, scaledCellWidth: number, scaledCellHeight: number): void 
  {
    ctx.putImageData(this.imageData, x*scaledCellWidth, y*scaledCellHeight)
  }

  public drawForeground(ctx: CanvasRenderingContext2D, x: number, y: number, scaledCellWidth: number, scaledCellHeight: number): void {}
  
}

// https://stackoverflow.com/questions/47637340/base64-binary-decode-32-bit-array
function toInt32(input: string) {
  var view = new DataView(new ArrayBuffer(4))
  for (var i = 0; i < 4; i++) {
    view.setUint8(i, input.charCodeAt(i));
  }
  return view.getInt32(0);
}
