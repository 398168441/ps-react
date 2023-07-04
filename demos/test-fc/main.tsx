import React, {useState} from 'react'
import ReactDOM from 'react-dom/client'

const App = () => {
	const [num] = useState(100)

	return <div>{num}</div>
}

const Child = () => {
	return (
		<div>
			<span>ps-react</span>
		</div>
	)
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<App />
)
