/**
 * useFetch - 通用数据获取 Hook
 * 封装 loading/error/data 状态，支持自动刷新和手动触发
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../api'

export function useFetch(url, options = {}) {
  const {
    immediate = true,    // 是否立即请求
    interval = 0,        // 自动刷新间隔 (ms), 0=不刷新
    deps = [],           // 额外依赖
    onSuccess,           // 成功回调
    onError,             // 错误回调
  } = options

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(immediate)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)
  const intervalRef = useRef(null)

  const execute = useCallback(async (overrideUrl) => {
    const targetUrl = overrideUrl || url
    if (!targetUrl) return

    try {
      setLoading(true)
      setError(null)
      const result = await api.get(targetUrl)
      if (mountedRef.current) {
        setData(result)
        onSuccess?.(result)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err)
        onError?.(err)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [url, onSuccess, onError])

  // 初始加载
  useEffect(() => {
    mountedRef.current = true
    if (immediate && url) {
      execute()
    }
    return () => { mountedRef.current = false }
  }, [url, immediate, ...deps])

  // 自动刷新
  useEffect(() => {
    if (interval > 0 && url) {
      intervalRef.current = setInterval(execute, interval)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [interval, url, execute])

  // 手动刷新
  const refresh = useCallback(() => execute(), [execute])

  return { data, loading, error, refresh, execute }
}


/**
 * useDebounce - 防抖 Hook
 * 延迟执行函数，避免频繁触发
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}


/**
 * useLocalStorage - 本地存储 Hook
 * 自动序列化/反序列化，支持 SSR
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (err) {
      console.warn(`localStorage set error [${key}]:`, err)
    }
  }, [key, storedValue])

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key)
      setStoredValue(initialValue)
    } catch (err) {
      console.warn(`localStorage remove error [${key}]:`, err)
    }
  }, [key, initialValue])

  return [storedValue, setValue, removeValue]
}


/**
 * useToggle - 布尔值切换 Hook
 */
export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue)
  const toggle = useCallback(() => setValue(v => !v), [])
  const setTrue = useCallback(() => setValue(true), [])
  const setFalse = useCallback(() => setValue(false), [])
  return { value, toggle, setTrue, setFalse, setValue }
}
