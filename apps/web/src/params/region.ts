import { findRegion, type RegionId } from '@maiq/core/arcades'
import type { ParamMatcher } from '@sveltejs/kit'

export const match = ((param: string): param is RegionId =>
  findRegion(param) !== undefined) satisfies ParamMatcher
