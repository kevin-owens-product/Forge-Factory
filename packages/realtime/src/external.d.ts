/**
 * @package @forge/realtime
 * @description External dependency type declarations
 */

declare module 'react' {
  export function createContext<T>(defaultValue: T): React.Context<T>;
  export function useContext<T>(context: React.Context<T>): T;
  export function useState<T>(initialState: T | (() => T)): [T, React.Dispatch<React.SetStateAction<T>>];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useCallback<T extends (...args: never[]) => unknown>(callback: T, deps: unknown[]): T;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
  export function useRef<T>(initialValue: T): React.MutableRefObject<T>;
  export function createElement(
    type: string | React.ComponentType<unknown>,
    props?: Record<string, unknown> | null,
    ...children: React.ReactNode[]
  ): React.ReactElement;

  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);
  export interface MutableRefObject<T> {
    current: T;
  }

  export interface ReactNode {}
  export interface ReactElement {}
  export interface ComponentType<P = {}> {
    (props: P): ReactElement | null;
  }
  export interface Context<T> {
    Provider: React.Provider<T>;
    Consumer: React.Consumer<T>;
  }
  export interface Provider<T> {
    (props: { value: T; children?: ReactNode }): ReactNode;
  }
  export interface Consumer<T> {
    (props: { children: (value: T) => ReactNode }): ReactNode;
  }
}
