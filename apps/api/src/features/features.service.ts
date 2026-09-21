import { Injectable } from '@nestjs/common';
import { resolveFeatures } from '@beauty/entitlements';
import { FeatureGuard } from '../common/guards/feature.guard';

@Injectable()
export class FeaturesService {
  constructor(private readonly featureGuard: FeatureGuard) {}

  async forMaster(masterId: string) {
    const snapshot = await this.featureGuard.loadSnapshot(masterId);
    const features = [...resolveFeatures(snapshot)];
    return { ...snapshot, features };
  }
}
