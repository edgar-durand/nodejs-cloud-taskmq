import 'reflect-metadata';

/**
 * Utility functions for working with reflect-metadata
 */

/**
 * Get metadata for a class or method
 */
export function getMetadata<T = any>(
  metadataKey: string | symbol,
  target: any,
  propertyKey?: string | symbol,
): T | undefined {
  if (propertyKey !== undefined) {
    return Reflect.getMetadata(metadataKey, target, propertyKey);
  }
  return Reflect.getMetadata(metadataKey, target);
}

/**
 * Define metadata for a class or method
 */
export function defineMetadata(
  metadataKey: string | symbol,
  metadataValue: any,
  target: any,
  propertyKey?: string | symbol,
): void {
  if (propertyKey !== undefined) {
    Reflect.defineMetadata(metadataKey, metadataValue, target, propertyKey);
  } else {
    Reflect.defineMetadata(metadataKey, metadataValue, target);
  }
}

/**
 * Check if metadata exists
 */
export function hasMetadata(
  metadataKey: string | symbol,
  target: any,
  propertyKey?: string | symbol,
): boolean {
  if (propertyKey !== undefined) {
    return Reflect.hasMetadata(metadataKey, target, propertyKey);
  }
  return Reflect.hasMetadata(metadataKey, target);
}

/**
 * Get all metadata keys for a target
 */
export function getMetadataKeys(target: any, propertyKey?: string | symbol): any[] {
  if (propertyKey !== undefined) {
    return Reflect.getMetadataKeys(target, propertyKey);
  }
  return Reflect.getMetadataKeys(target);
}

/**
 * Get own metadata (not inherited)
 */
export function getOwnMetadata<T = any>(
  metadataKey: string | symbol,
  target: any,
  propertyKey?: string | symbol,
): T | undefined {
  if (propertyKey !== undefined) {
    return Reflect.getOwnMetadata(metadataKey, target, propertyKey);
  }
  return Reflect.getOwnMetadata(metadataKey, target);
}

/**
 * Get own metadata keys (not inherited)
 */
export function getOwnMetadataKeys(target: any, propertyKey?: string | symbol): any[] {
  if (propertyKey !== undefined) {
    return Reflect.getOwnMetadataKeys(target, propertyKey);
  }
  return Reflect.getOwnMetadataKeys(target);
}

/**
 * Delete metadata
 */
export function deleteMetadata(
  metadataKey: string | symbol,
  target: any,
  propertyKey?: string | symbol,
): boolean {
  if (propertyKey !== undefined) {
    return Reflect.deleteMetadata(metadataKey, target, propertyKey);
  }
  return Reflect.deleteMetadata(metadataKey, target);
}

/**
 * Get all method names of a class instance that have specific metadata
 */
export function getMethodsWithMetadata(
  instance: any,
  metadataKey: string | symbol,
): string[] {
  const prototype = Object.getPrototypeOf(instance);
  const methods: string[] = [];
  
  const propertyNames = Object.getOwnPropertyNames(prototype);
  for (const propertyName of propertyNames) {
    if (propertyName === 'constructor') continue;
    
    const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
    if (descriptor && typeof descriptor.value === 'function') {
      if (hasMetadata(metadataKey, instance, propertyName)) {
        methods.push(propertyName);
      }
    }
  }
  
  return methods;
}

/**
 * Get all methods with their metadata
 */
export function getMethodsWithMetadataValues<T = any>(
  instance: any,
  metadataKey: string | symbol,
): Array<{ methodName: string; metadata: T }> {
  const prototype = Object.getPrototypeOf(instance);
  const methods: Array<{ methodName: string; metadata: T }> = [];
  
  const propertyNames = Object.getOwnPropertyNames(prototype);
  for (const propertyName of propertyNames) {
    if (propertyName === 'constructor') continue;
    
    const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
    if (descriptor && typeof descriptor.value === 'function') {
      const metadata = getMetadata<T>(metadataKey, instance, propertyName);
      if (metadata !== undefined) {
        methods.push({
          methodName: propertyName,
          metadata,
        });
      }
    }
  }
  
  return methods;
}

/**
 * Helper to merge metadata arrays
 */
export function mergeMetadataArrays<T>(
  target: any,
  metadataKey: string | symbol,
  newItems: T[],
  propertyKey?: string | symbol,
): void {
  const existing = getMetadata<T[]>(metadataKey, target, propertyKey) || [];
  const merged = [...existing, ...newItems];
  defineMetadata(metadataKey, merged, target, propertyKey);
}

/**
 * Helper to add single metadata item to an array
 */
export function addMetadataItem<T>(
  target: any,
  metadataKey: string | symbol,
  item: T,
  propertyKey?: string | symbol,
): void {
  mergeMetadataArrays(target, metadataKey, [item], propertyKey);
}
