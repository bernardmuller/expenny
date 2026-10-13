'use client'

import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Input } from './input'
import type { FilterItems } from '@/components/filter/Filter.types'

interface SearchableSelectOption {
  label: string
  value: string
}

export interface SearchableSelectProps {
  options: FilterItems
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  isDisabled?: boolean
  isLoading?: boolean
  isClearable?: boolean
  isSearchable?: boolean
  className?: string
  name?: string
  'aria-invalid'?: boolean
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  isDisabled = false,
  isLoading = false,
  isClearable = true,
  isSearchable = true,
  className,
  name,
  'aria-invalid': ariaInvalid,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [inputValue, setInputValue] = React.useState('')
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selectedOption = options.find((option) => option.value === value)

  React.useEffect(() => {
    if (selectedOption && !isOpen) {
      setInputValue(selectedOption.label)
    } else if (!isOpen && !value) {
      setInputValue('')
    }
  }, [selectedOption, isOpen, value])

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery && !inputValue) return options
    const query = (isOpen ? searchQuery || inputValue : '').toLowerCase()
    if (!query) return options
    return options.filter((option) =>
      option.label.toLowerCase().includes(query),
    )
  }, [options, searchQuery, inputValue, isOpen])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setSearchQuery('')
        if (selectedOption) {
          setInputValue(selectedOption.label)
        } else {
          setInputValue('')
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, selectedOption])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setSearchQuery(newValue)
    if (!isOpen) {
      setIsOpen(true)
    }
  }

  const handleInputFocus = () => {
    if (!isDisabled && !isLoading) {
      setIsOpen(true)
      if (isSearchable) {
        setInputValue('')
        setSearchQuery('')
      }
    }
  }

  const handleSelect = (selectedValue: string) => {
    const option = options.find((opt) => opt.value === selectedValue)
    onChange(selectedValue)
    setInputValue(option?.label || '')
    setSearchQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setInputValue('')
    setSearchQuery('')
    inputRef.current?.focus()
  }

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!isDisabled && !isLoading) {
      if (isOpen) {
        // Close dropdown
        setIsOpen(false)
        setSearchQuery('')
        if (selectedOption) {
          setInputValue(selectedOption.label)
        } else {
          setInputValue('')
        }
        inputRef.current?.blur()
      } else {
        // Open dropdown
        inputRef.current?.focus()
        setIsOpen(true)
        if (isSearchable) {
          setInputValue('')
          setSearchQuery('')
        }
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchQuery('')
      if (selectedOption) {
        setInputValue(selectedOption.label)
      } else {
        setInputValue('')
      }
      inputRef.current?.blur()
    } else if (e.key === 'Enter' && filteredOptions.length === 1) {
      e.preventDefault()
      handleSelect(filteredOptions[0].value)
    }
  }

  const displayPlaceholder = React.useMemo(() => {
    if (isLoading) return 'Loading...'
    if (isOpen) {
      return placeholder.replace(/^Select\s+/i, 'Search ')
    }
    return placeholder
  }, [isLoading, isOpen, placeholder])

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          name={name}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={displayPlaceholder}
          disabled={isDisabled || isLoading}
          aria-invalid={ariaInvalid}
          className={cn(
            'pr-16',
            isSearchable ? 'cursor-text' : 'cursor-pointer',
          )}
          readOnly={!isSearchable}
          autoComplete="off"
        />
        <div
          className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center
            gap-1"
        >
          {isClearable && value && !isDisabled && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="hover:bg-raised rounded p-1 transition-colors"
              tabIndex={-1}
            >
              <X className="h-5 w-5 opacity-50 hover:opacity-100" />
            </button>
          )}
          <button
            type="button"
            onClick={handleChevronClick}
            className="transition-opacity hover:opacity-100"
            tabIndex={-1}
            disabled={isDisabled || isLoading}
          >
            <ChevronDown
              className={cn(
                'h-5 w-5 opacity-50 transition-transform',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className={cn(
            `bg-raised border-border text-foreground absolute z-50 mt-1 w-full
            rounded-[14px] border shadow-lg`,
            'max-h-[300px] overflow-y-auto',
            'animate-in fade-in-0 zoom-in-95',
          )}
        >
          {filteredOptions.length === 0 ? (
            <div className="text-muted-foreground py-6 text-center text-sm">
              No option found.
            </div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    `relative flex cursor-pointer items-center rounded-[10px]
                      px-2 py-3 text-sm outline-none select-none`,
                    'hover:bg-card hover:text-foreground',
                    'transition-colors',
                    value === option.value && 'bg-accent',
                  )}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
