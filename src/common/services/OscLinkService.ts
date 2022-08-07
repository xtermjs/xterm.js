import { IBufferService, IOscLinkService } from 'common/services/Services';
import { IOscLinkData } from 'common/Types';

export class OscLinkService implements IOscLinkService {
  public serviceBrand: any;

  constructor(
    @IBufferService private readonly _bufferService: IBufferService
  ) {
  }

  public registerLink(linkData: IOscLinkData): number {
    console.log('register link');
    // TODO: Add and return properly
    return 1;
  }

  public getLinkData(linkId: number): IOscLinkData | undefined {
    return {
      uri: 'https://github.com'
    };
  }
}
