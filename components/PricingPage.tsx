
import React from 'react';
import { useNavigate } from 'react-router-dom';
import LeftArrowIcon from './icons/LeftArrowIcon'; // For back button
import CheckCircleIcon from './icons/CheckCircleIcon'; // For feature list

const PricingPage: React.FC = () => {
  const navigate = useNavigate();

  const plans = [
    {
      name: 'FREE',
      price: '$0',
      priceSuffix: '/ month',
      features: [
        '10 Credits daily',
        'Publish up to 5 Websites',
        'No Boongle AI Badge on first 14 days',
      ],
      cta: 'Get Started',
      color: 'blue',
      isPopular: false,
    },
    {
      name: 'PRO',
      price: '$4.99',
      priceSuffix: '/ month',
      features: [
        '500 Credits monthly',
        'Publish up to 15 Websites',
        'No Boongle AI Badge',
        'Create a Referral link. If you invite one friend / person which registered an account gets you +5 extra Credits.',
      ],
      cta: 'Choose Pro',
      color: 'purple',
      isPopular: true,
    },
    {
      name: 'PREMIUM',
      price: '$9.99',
      priceSuffix: '/ month',
      features: [
        'Everything in Pro',
        'Unlimited Credits',
        'Unlimited Published Sites',
        'No Badge',
        'Pro Subscription for a friend (1 week)',
      ],
      cta: 'Go Premium',
      color: 'green',
      isPopular: false,
    },
  ];

  const getButtonClass = (color: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
      case 'purple': return 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500';
      case 'green': return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
      default: return 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500';
    }
  };


  return (
    <div className="min-h-screen bg-black text-white p-4 pt-10 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-10 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            title="Back to Home"
            className="p-2 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white transition-colors flex items-center"
            aria-label="Back to Home"
          >
            <LeftArrowIcon className="w-5 h-5 mr-2" />
            Back to Home
          </button>
           <h1 className="text-3xl md:text-4xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 flex-grow">
            Choose Your Plan
          </h1>
          <div className="w-auto" style={{minWidth: "140px"}}></div> {/* Spacer for true centering of title */}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div 
              key={index} 
              className={`relative flex flex-col bg-gray-800 p-6 rounded-2xl shadow-2xl border ${plan.isPopular ? 'border-purple-500' : 'border-gray-700'} transform hover:scale-105 transition-transform duration-200 ease-in-out`}
            >
              {plan.isPopular && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full shadow-md">
                  Most Popular
                </div>
              )}
              <h2 className={`text-2xl font-semibold mb-2 text-center ${plan.color === 'blue' ? 'text-blue-400' : plan.color === 'purple' ? 'text-purple-400' : 'text-green-400'}`}>
                {plan.name}
              </h2>
              <div className="text-center mb-6">
                <span className="text-4xl font-extrabold text-white">{plan.price}</span>
                <span className="text-gray-400 text-sm">{plan.priceSuffix}</span>
              </div>
              <ul className="space-y-3 mb-8 text-gray-300 flex-grow">
                {plan.features.map((feature, fIndex) => (
                  <li key={fIndex} className="flex items-start">
                    <CheckCircleIcon className={`w-5 h-5 mr-2 mt-0.5 flex-shrink-0 ${plan.color === 'blue' ? 'text-blue-500' : plan.color === 'purple' ? 'text-purple-500' : 'text-green-500'}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button 
                className={`w-full mt-auto p-3 font-semibold text-white rounded-lg shadow-md hover:shadow-lg transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-75 ${getButtonClass(plan.color)}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-500 mt-12 text-sm">
          All prices are in USD. Plans are for illustrative purposes only.
        </p>
      </div>
    </div>
  );
};

export default PricingPage;
