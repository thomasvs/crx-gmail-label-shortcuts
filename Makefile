include credentials
export

manifest.json: manifest.json.in credentials
	envsubst < manifest.json.in > manifest.json
