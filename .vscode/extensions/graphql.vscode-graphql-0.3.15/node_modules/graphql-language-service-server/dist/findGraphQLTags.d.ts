import { Range } from 'graphql-language-service-utils';
export declare const DEFAULT_TAGS: string[];
declare type TagResult = {
    tag: string;
    template: string;
    range: Range;
};
export declare function findGraphQLTags(text: string, ext: string): TagResult[];
export {};
//# sourceMappingURL=findGraphQLTags.d.ts.map