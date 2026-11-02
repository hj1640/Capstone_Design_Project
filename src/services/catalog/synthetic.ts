import { foods, products, catalogVersion } from '../../data/catalog-stage3';
import { createCatalogService } from './search';
export const syntheticCatalog = createCatalogService({ foods, products, version: catalogVersion, synthetic: true });
