export function loadCSV(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      encoding: 'utf-8-sig',
      complete: (result) => {
        const fatal = result.errors ? result.errors.filter(e => e.type === 'FieldMismatch' || e.type === 'Quotes' || e.type === 'UndetectableDelimiter') : []
        if (fatal.length > 0) {
          reject(new Error('CSV parse error: ' + fatal[0].message))
          return
        }
        resolve(result.data)
      },
      error: (err) => reject(err)
    })
  })
}

export function loadCSVText(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true, encoding: 'utf-8-sig' })
  if (result.errors && result.errors.length > 0) {
    throw new Error('CSV parse error: ' + result.errors[0].message)
  }
  return result.data
}

export function generateCSV(data, fields) {
  return Papa.unparse({
    fields: fields,
    data: data
  })
}
