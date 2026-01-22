/**
 * @package @forge/feature-flags
 * @description External dependency type declarations
 */

declare module 'react' {
  export type ReactNode = React.ReactElement | string | number | boolean | null | undefined | Iterable<ReactNode> | ReactNode[];
  export type ReactElement = { type: unknown; props: unknown; key: string | null };

  export interface Context<T> {
    Provider: Provider<T>;
    Consumer: Consumer<T>;
  }
  export interface Provider<T> {
    (props: { value: T; children?: ReactNode }): ReactNode;
  }
  export interface Consumer<T> {
    (props: { children: (value: T) => ReactNode }): ReactNode;
  }
  export interface FC<P = object> {
    (props: P): ReactNode | null;
  }
  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }
  export interface RefObject<T> {
    current: T | null;
  }
  export interface MutableRefObject<T> {
    current: T;
  }
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);

  export function createContext<T>(defaultValue: T): Context<T>;
  export function useContext<T>(context: Context<T>): T;
  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: readonly unknown[]): T;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useRef<T>(initialValue: T | null): RefObject<T>;
  export function memo<P extends object>(component: FC<P>): FC<P>;
}

declare namespace React {
  export type ReactNode = import('react').ReactNode;
  export type ReactElement = import('react').ReactElement;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: unknown, props: unknown, key?: string): unknown;
  export function jsxs(type: unknown, props: unknown, key?: string): unknown;
  export const Fragment: symbol;
}
