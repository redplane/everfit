import { Module } from '@nestjs/common';
import { ScaleUnitConversionService } from './scale-unit-conversion.service';
import { ScaleUnitConversionServiceInjectionTokens } from './scale-unit-conversion-injection-tokens';

/**
 * Provides `IScaleUnitConversionService` under the `SERVICE__SCALE_UNIT_CONVERSION` token and exports
 * it for downstream consumers (F5–F8).
 *
 * `useFactory` (not `useClass`) is deliberate: the service's constructor takes an optional registry
 * (`definitions`, `baseCodesByCategory`) that defaults to the production constants. Nest does not
 * honor TypeScript default parameter values — with `useClass` it would try to resolve those params as
 * providers and fail to boot ("can't resolve dependencies … argument Array"). Instantiating via the
 * factory lets the defaults apply, binding the service to the production registry with no params.
 */
@Module({
  providers: [
    {
      provide: ScaleUnitConversionServiceInjectionTokens.SERVICE__SCALE_UNIT_CONVERSION,
      useFactory: () => new ScaleUnitConversionService(),
    },
  ],
  exports: [ScaleUnitConversionServiceInjectionTokens.SERVICE__SCALE_UNIT_CONVERSION],
})
export class ScaleUnitConversionServiceModule {}
