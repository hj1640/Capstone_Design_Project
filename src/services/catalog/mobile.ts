import { foods, products, catalogVersion } from '../../data/catalog-stage3';
import index from '../../data/catalog-embeddings-stage5.json';
import quantization from '../../../models/stage5-quantization.json';
import { embedNative } from '../embedding/native';
import { createSemanticSearch } from './semantic';

export const searchSemanticProducts = createSemanticSearch({ foods, products, version:catalogVersion, synthetic:true },
  index, embedNative, quantization.output.sha256);
