import { IServiceIdentifier } from 'common/services/Services';
export declare const serviceRegistry: Map<string, IServiceIdentifier<any>>;
export declare function getServiceDependencies(ctor: any): {
    id: IServiceIdentifier<any>;
    index: number;
    optional: boolean;
}[];
export declare function createDecorator<T>(id: string): IServiceIdentifier<T>;
//# sourceMappingURL=ServiceRegistry.d.ts.map